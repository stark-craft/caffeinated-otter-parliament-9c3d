import { useEffect, useRef } from 'react'
import VideoPlayer from '../components/VideoPlayer.jsx'
import { tvRemoteKey } from '../tizen/tvRemoteKeys.js'
import UniversalGuideHome from './UniversalGuideHome.jsx'
import './universalGuide.css'

// Same host contract as VideoPlayer. Keep its video mounted, source resolver,
// media keys and commerce keyboard dispatcher intact. Hoist only the supplied
// overlay to the full home stage, so a small video tile cannot clip the panel.
export default function UniversalGuidePlayer({ onProductSelect, ...playerProps }) {
  const rootRef = useRef(null)
  const classic = new URLSearchParams(window.location.search).get('home') === 'classic'
  useEffect(() => {
    if (classic) return
    const changed = () => playerProps.onFullscreenChange?.(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [classic, playerProps.onFullscreenChange])
  if (classic) {
    return <VideoPlayer {...playerProps} />
  }
  const { paneOpen, commerceOverlay, onOpenShop } = playerProps
  return (
    <div ref={rootRef} className={`ug-player ${paneOpen ? 'ug-shop-open' : ''}`} onKeyDownCapture={event => {
      if (tvRemoteKey(event).toLowerCase() !== 'f' || event.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
      event.preventDefault()
      event.stopPropagation()
      // Fullscreen must include the QR/shop overlay as well as the video tile.
      const action = document.fullscreenElement ? document.exitFullscreen?.() : rootRef.current?.requestFullscreen?.()
      action?.catch?.(() => {})
    }}>
      <div className="ug-home-frame">
        <UniversalGuideHome paneOpen={paneOpen} onProductSelect={onProductSelect} onOpenShop={onOpenShop}
          nowPlaying={<VideoPlayer {...playerProps} commerceOverlay={null} onFullscreenChange={undefined} />} />
      </div>
      <div className={`video-player ug-commerce-host ${paneOpen ? 'vp-commerce-open' : ''}`}>
        <div className="vp-commerce-overlay">{commerceOverlay}</div>
      </div>
    </div>
  )
}
