import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import VideoPlayer from '../components/VideoPlayer.jsx'
import { tvRemoteKey } from '../tizen/tvRemoteKeys.js'
import UniversalGuideHome from './UniversalGuideHome.jsx'
import './reference.css'
import './universalGuide.css'

// Same host contract as VideoPlayer. Keep its video mounted, source resolver
// and commerce keyboard dispatcher. The host owns Play/Pause-to-home in the
// full guide video view and keeps the overlay outside the small video tile.
export default function UniversalGuidePlayer({ onProductSelect, ...playerProps }) {
  const rootRef = useRef(null)
  const homeStageRef = useRef(null)
  const [videoView, setVideoView] = useState(false)
  const classic = new URLSearchParams(window.location.search).get('home') === 'classic'
  useLayoutEffect(() => {
    if (classic) return
    const root = rootRef.current
    const stage = homeStageRef.current
    const resizeHome = () => {
      const width = root.clientWidth
      if (!width) return
      // Keep the full home layout and shrink it like the original video.
      // Measuring the reserved stage also handles the panel's clamped width.
      root.style.setProperty('--ug-home-width', `${width}px`)
      root.style.setProperty('--ug-home-scale', String(stage.clientWidth / width))
    }
    resizeHome()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resizeHome) : null
    observer?.observe(root)
    observer?.observe(stage)
    window.addEventListener('resize', resizeHome)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resizeHome)
    }
  }, [classic, playerProps.paneOpen, videoView])
  useLayoutEffect(() => {
    if (videoView && !playerProps.paneOpen) rootRef.current?.focus({ preventScroll: true })
  }, [videoView, playerProps.paneOpen])
  useEffect(() => {
    if (classic) return
    const changed = () => playerProps.onFullscreenChange?.(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [classic, playerProps.onFullscreenChange])
  useEffect(() => {
    if (classic || !videoView) return
    const control = event => {
      if (event.defaultPrevented || event.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
      const key = tvRemoteKey(event)
      if (['MediaPlayPause', 'MediaPlay', 'MediaPause', ' '].includes(key)) {
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) {
          playerProps.onCloseShop?.()
          setVideoView(false)
        }
      } else if (!playerProps.paneOpen && ['Backspace', 'Escape'].includes(key)) {
        // Tizen's Return/Back key (10009) returns to the Samsung dummy home
        // when no commerce panel is open; never turn Back into an order action.
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) setVideoView(false)
      }
    }
    document.addEventListener('keydown', control, true)
    return () => document.removeEventListener('keydown', control, true)
  }, [classic, videoView, playerProps.paneOpen, playerProps.onCloseShop])
  if (classic) {
    return <VideoPlayer {...playerProps} />
  }
  const { paneOpen, commerceOverlay, onCloseShop } = playerProps
  return (
    <div ref={rootRef} tabIndex={-1} className={`ug-player ${paneOpen ? 'ug-shop-open' : ''} ${videoView ? 'ug-video-view' : ''}`} onKeyDownCapture={event => {
      if (event.defaultPrevented) return
      if (event.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
      const key = tvRemoteKey(event)
      if (['Backspace', 'Escape'].includes(key)) {
        if (!videoView && paneOpen) {
          event.preventDefault()
          event.stopPropagation()
          onCloseShop?.()
          return
        }
        if (videoView && !paneOpen) {
          event.preventDefault()
          event.stopPropagation()
          if (!event.repeat) setVideoView(false)
          return
        }
      }
      if (!videoView && key.toLowerCase() === 's') {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      if (key.toLowerCase() !== 'f') return
      event.preventDefault()
      event.stopPropagation()
      // Fullscreen must include the QR/shop overlay as well as the video tile.
      const action = document.fullscreenElement ? document.exitFullscreen?.() : rootRef.current?.requestFullscreen?.()
      action?.catch?.(() => {})
    }}>
      <div ref={homeStageRef} className="ug-home-stage">
        <div className="ug-home-frame">
          <UniversalGuideHome paneOpen={paneOpen} videoView={videoView} onProductSelect={onProductSelect} onOpenVideo={() => setVideoView(true)}
            nowPlaying={<VideoPlayer {...playerProps} commerceOverlay={null} onFullscreenChange={undefined} />} />
        </div>
      </div>
      <div className={`video-player ug-commerce-host ${paneOpen ? 'vp-commerce-open' : ''}`}>
        <div className="vp-commerce-overlay" onScroll={event => {
          // Fallback for TV engines without overflow:clip. Panel focus must
          // never scroll this stationary host horizontally off its contents.
          if (event.currentTarget.scrollLeft) event.currentTarget.scrollLeft = 0
        }}>{commerceOverlay}</div>
      </div>
      {videoView && !paneOpen && <button className="ug-video-back" onClick={() => setVideoView(false)}
        onKeyDown={event => {
          if (tvRemoteKey(event) === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            setVideoView(false)
          }
        }}>‹ TV home <span>Back · Play/Pause · Space</span></button>}
    </div>
  )
}
