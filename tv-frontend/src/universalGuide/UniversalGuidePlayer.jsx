import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import VideoPlayer from '../components/VideoPlayer.jsx'
import { tvRemoteKey } from '../tizen/tvRemoteKeys.js'
import UniversalGuideHome from './UniversalGuideHome.jsx'
import { videoSurfaceGeometry } from './videoSurfaceGeometry.js'
import './reference.css'
import './universalGuide.css'

// Same host contract as VideoPlayer. Keep its video mounted, source resolver
// and commerce keyboard dispatcher. The host owns Play/Pause-to-home in the
// full guide video view and keeps the overlay outside the small video tile.
export default function UniversalGuidePlayer({ onProductSelect, ...playerProps }) {
  const rootRef = useRef(null)
  const homeStageRef = useRef(null)
  const videoAnchorRef = useRef(null)
  const videoSurfaceRef = useRef(null)
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
  // The original video lived *inside* .ug-home-frame, which is animated with
  // transform:scale when QuickBite opens. Samsung's hardware decoder can render
  // black frames or suspend that transformed media layer. Keep one video
  // element mounted as a sibling of the animated guide. Only its screen-space
  // box follows the tile; opening the panel NEVER unmounts or reloads it.
  useLayoutEffect(() => {
    if (classic) return
    const root = rootRef.current
    const tile = videoAnchorRef.current
    const surface = videoSurfaceRef.current
    const stage = homeStageRef.current
    if (!root || !tile || !surface || !stage) return

    let active = true
    let frame = 0
    let animateUntil = 0

    function reposition() {
      if (!active) return
      const bounds = root.getBoundingClientRect()
      const homeFrame = root.querySelector('.ug-home-frame')
      const feed = root.querySelector('.ug-feed')
      const hidden = !videoView &&
        (Boolean(tile.closest('.ug-hidden-row')) || !tile.getClientRects().length)
      const measured = videoSurfaceGeometry({
        root: bounds,
        tile: tile.getBoundingClientRect(),
        // The untransformed video must still respect home-feed scrolling
        // and the rounded home frame's visible bounds.
        clips: [stage.getBoundingClientRect(),
          homeFrame?.getBoundingClientRect(), feed?.getBoundingClientRect()],
        fullscreen: videoView,
        fullscreenWidth: paneOpen ? stage.getBoundingClientRect().width : null,
        hidden,
      })
      if (!measured) {
        surface.style.visibility = 'hidden'
        return
      }
      const next = {
        left: `${measured.left}px`,
        top: `${measured.top}px`,
        width: `${measured.width}px`,
        height: `${measured.height}px`,
        clipPath: measured.clipPath,
        visibility: 'visible',
      }
      // Avoid needless surface invalidation on every animation frame.
      for (const [property, value] of Object.entries(next)) {
        if (surface.style[property] !== value) surface.style[property] = value
      }
    }
    function tick() {
      frame = 0
      reposition()
      if (active && performance.now() < animateUntil) {
        frame = requestAnimationFrame(tick)
      }
    }
    function followTransition() {
      animateUntil = performance.now() + 450
      if (!frame) frame = requestAnimationFrame(tick)
    }
    function scheduleOneFrame() {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(followTransition) : null
    for (const element of [root, stage, tile, root.querySelector('.ug-feed'),
      root.querySelector('.ug-home-frame')]) {
      if (element) observer?.observe(element)
    }
    const firstRow = tile.closest('.ug-first-row')
    const mutation = firstRow && typeof MutationObserver !== 'undefined'
      ? new MutationObserver(scheduleOneFrame) : null
    if (mutation) mutation.observe(firstRow, {
      attributes: true, attributeFilter: ['class', 'style'],
    })

    root.addEventListener('scroll', scheduleOneFrame, true)
    root.addEventListener('focusin', followTransition, true)
    root.addEventListener('focusout', followTransition, true)
    root.addEventListener('transitionrun', followTransition, true)
    root.addEventListener('transitionend', scheduleOneFrame, true)
    window.addEventListener('resize', followTransition)
    reposition()
    followTransition()
    return () => {
      active = false
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
      mutation?.disconnect()
      root.removeEventListener('scroll', scheduleOneFrame, true)
      root.removeEventListener('focusin', followTransition, true)
      root.removeEventListener('focusout', followTransition, true)
      root.removeEventListener('transitionrun', followTransition, true)
      root.removeEventListener('transitionend', scheduleOneFrame, true)
      window.removeEventListener('resize', followTransition)
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
      if (!playerProps.paneOpen && ['MediaPlayPause', 'MediaPlay', 'MediaPause', ' '].includes(key)) {
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
    // Some Samsung Tizen engines deliver remote Return/Back as the
    // 'tizenhwkey' event instead of a normal keydown (keyCode 10009).
    // Consume it only inside full-video mode; otherwise the platform owns it.
    const tizenBack = event => {
      if (event.keyName !== 'back' && event.keyName !== 'Back') return
      if (playerProps.paneOpen) return
      event.preventDefault?.()
      event.stopPropagation?.()
      setVideoView(false)
    }
    document.addEventListener('keydown', control, true)
    document.addEventListener('tizenhwkey', tizenBack, true)
    return () => {
      document.removeEventListener('keydown', control, true)
      document.removeEventListener('tizenhwkey', tizenBack, true)
    }
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
            videoAnchorRef={videoAnchorRef} />
        </div>
      </div>
      {/* This single untransformed media surface survives every guide resize,
          fullscreen switch and QuickBite open/close. Only its box changes. */}
      <div ref={videoSurfaceRef} className="ug-live-video-surface">
        <VideoPlayer {...playerProps} compactMode commerceOverlay={null} onFullscreenChange={undefined} />
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
