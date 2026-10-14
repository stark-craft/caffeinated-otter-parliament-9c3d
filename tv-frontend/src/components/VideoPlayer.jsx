import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PACKAGED_VIDEO_SRC,
  resolvePreferredVideoSource,
  TV_VIDEO_FILENAME,
} from '../tizen/usbVideo.js'
import { registerTvMediaKeys, tvRemoteKey } from '../tizen/tvRemoteKeys.js'

export default function VideoPlayer({
  paneOpen,
  onOpenShop,
  onCloseShop,
  commerceOverlay,
  commerceRef,
  onFullscreenChange,
  compactMode = false,
}) {
  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  // Remember explicit user play/pause intent so opening a shopping panel
  // cannot unpause content the viewer intentionally stopped.
  const shouldPlayRef = useRef(true)
  const lastAutoResumeRef = useRef(0)
  const [videoSourceKind, setVideoSourceKind] = useState('resolving')
  const [videoSrc, setVideoSrc] = useState('')
  const [mediaError, setMediaError] = useState(false)
  const [ambientColor, setAmbientColor] = useState('36 75 54')
  const [videoAspect, setVideoAspect] = useState('16 / 9')

  const loadPreferredVideoSource = useCallback(async () => {
    setMediaError(false)
    setVideoSourceKind('resolving')
    const resolved = await resolvePreferredVideoSource()
    setVideoSourceKind(resolved.kind)
    setVideoSrc(resolved.src)
  }, [])

  useEffect(() => {
    let active = true
    resolvePreferredVideoSource().then((resolved) => {
      if (!active) return
      setVideoSourceKind(resolved.kind)
      setVideoSrc(resolved.src)
      setMediaError(false)
    })
    return () => { active = false }
  }, [])

  const startPlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video || !videoSrc || mediaError || !shouldPlayRef.current) return
    try {
      await video.play()
    } catch (error) {
      if (error?.name !== 'NotAllowedError') return
      // Desktop Chrome blocks unmuted autoplay; Tizen can still start with sound.
      video.muted = true
      try { await video.play() } catch { /* Playback needs a user gesture. */ }
    }
  }, [mediaError, videoSrc])

  useEffect(() => { startPlayback() }, [startPlayback])

  const togglePlay = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      shouldPlayRef.current = true
      try { await video.play() } catch { /* Source may still be loading. */ }
    } else {
      shouldPlayRef.current = false
      video.pause()
    }
  }, [])

  const seekBy = useCallback((seconds) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
  }, [])

  const toggleMute = useCallback(() => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await rootRef.current?.requestFullscreen?.()
    } catch { /* Fullscreen is not supported on every TV WebView. */ }
  }, [])

  useEffect(() => {
    registerTvMediaKeys()
    function onFullscreen() {
      onFullscreenChange?.(document.fullscreenElement === rootRef.current)
    }
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [onFullscreenChange])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented) return
      const target = event.target
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return
      const key = tvRemoteKey(event)

      if (paneOpen && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Backspace', 'Escape'].includes(key)) {
        event.preventDefault()
        commerceRef.current?.handleKey?.(key)
        return
      }
      if (!paneOpen && key === 'Enter') {
        event.preventDefault()
        if (!event.repeat) onOpenShop()
        return
      }
      if (key === 'MediaPlayPause' || key === ' ') {
        event.preventDefault()
        togglePlay()
      } else if (key === 'MediaPlay') {
        event.preventDefault()
        startPlayback()
      } else if (key === 'MediaPause' || key === 'MediaStop') {
        event.preventDefault()
        shouldPlayRef.current = false
        videoRef.current?.pause()
      } else if (key === 'MediaRewind' || key === 'ArrowLeft') {
        event.preventDefault()
        seekBy(-10)
      } else if (key === 'MediaFastForward' || key === 'ArrowRight') {
        event.preventDefault()
        seekBy(10)
      } else if (key.toLowerCase() === 'm') {
        event.preventDefault()
        toggleMute()
      } else if (key.toLowerCase() === 'f') {
        event.preventDefault()
        toggleFullscreen()
      } else if (key.toLowerCase() === 's') {
        event.preventDefault()
        paneOpen ? onCloseShop() : onOpenShop()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [commerceRef, onCloseShop, onOpenShop, paneOpen, seekBy, startPlayback, toggleFullscreen, toggleMute, togglePlay])

  // Tizen may briefly suspend its hardware video surface while a panel
  // layout is changing. Resume only when playback was already intended,
  // never in response to a deliberate pause or while the page is hidden.
  useEffect(() => {
    if (!paneOpen || !shouldPlayRef.current) return
    const frame = requestAnimationFrame(() => {
      if (videoRef.current?.paused && shouldPlayRef.current) startPlayback()
    })
    return () => cancelAnimationFrame(frame)
  }, [paneOpen, startPlayback])

  function resumeUnexpectedPause() {
    if (!paneOpen || !shouldPlayRef.current || document.hidden) return
    const now = Date.now()
    if (now - lastAutoResumeRef.current < 1500) return
    lastAutoResumeRef.current = now
    requestAnimationFrame(() => {
      if (videoRef.current?.paused && shouldPlayRef.current) startPlayback()
    })
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const canvas = canvasRef.current || document.createElement('canvas')
        canvasRef.current = canvas
        canvas.width = 16
        canvas.height = 9
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(video, 0, 0, 16, 9)
        const pixels = context.getImageData(0, 0, 16, 9).data
        let red = 0, green = 0, blue = 0, count = 0
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 72) continue
          red += pixels[i]
          green += pixels[i + 1]
          blue += pixels[i + 2]
          count++
        }
        if (count) setAmbientColor(`${Math.round(red / count)} ${Math.round(green / count)} ${Math.round(blue / count)}`)
      } catch {
        // Protected video frames cannot be sampled; retain the cricket-green backdrop.
      }
    }, 1500)
    return () => window.clearInterval(timer)
  }, [])

  function handleMediaError() {
    if (videoSourceKind === 'usb') {
      setMediaError(false)
      setVideoSourceKind('fallback')
      setVideoSrc(PACKAGED_VIDEO_SRC)
    } else {
      setMediaError(true)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`video-player${paneOpen && !compactMode ? ' vp-commerce-open' : ''}`}
      style={{ '--vp-ambient-rgb': ambientColor, '--vp-video-aspect': videoAspect }}
    >
      <div className="vp-stage">
        <div className="vp-viewing-area">
        <video
          key={videoSrc || 'resolving-video'}
          ref={videoRef}
          className="vp-media"
          src={videoSrc || undefined}
          autoPlay
          loop
          playsInline
          preload="auto"
          controls={false}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget
            if (videoWidth && videoHeight) setVideoAspect(`${videoWidth} / ${videoHeight}`)
          }}
          onCanPlay={startPlayback}
          onPause={resumeUnexpectedPause}
          onEnded={(event) => {
            event.currentTarget.currentTime = 0
            startPlayback()
          }}
          onError={handleMediaError}
          aria-label="TV content"
        />
        {videoSourceKind === 'resolving' && !mediaError && (
          <div className="vp-empty vp-source-loading" role="status">
            <span>USB</span>
            <h2>Loading TV content</h2>
            <p>Looking for <code>{TV_VIDEO_FILENAME}</code> on USB…</p>
          </div>
        )}
        {mediaError && (
          <div className="vp-empty" role="status">
            <span>▶</span>
            <h2>TV content unavailable</h2>
            <p>USB root: <code>{TV_VIDEO_FILENAME}</code> · fallback: <code>{PACKAGED_VIDEO_SRC}</code></p>
            <button className="vp-retry-media" onClick={loadPreferredVideoSource}>Retry video</button>
          </div>
        )}
        </div>
      </div>
      <div className="vp-commerce-overlay">{commerceOverlay}</div>
    </div>
  )
}
