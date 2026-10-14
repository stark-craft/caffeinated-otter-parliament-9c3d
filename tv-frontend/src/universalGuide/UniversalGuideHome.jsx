import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tvRemoteKey } from '../tizen/tvRemoteKeys.js'
import { GUIDE_TABS, HERO_SLIDES } from './catalog.js'
import { FIRST_ROWS, GUIDE_ROWS } from './rows.js'
import GuideArt from './GuideArt.jsx'
import GuideRow, { GuideCards } from './GuideRow.jsx'
import GuideSidebar from './GuideSidebar.jsx'

export default function UniversalGuideHome({ paneOpen, videoView, onProductSelect, onOpenVideo, nowPlaying }) {
  const [activeTab, setActiveTab] = useState('For You')
  const [slideIndex, setSlideIndex] = useState(0)
  const [heroExpanded, setHeroExpanded] = useState(false)
  const rootRef = useRef(null)
  const feedRef = useRef(null)
  const heroRef = useRef(null)
  const returnFocus = useRef(null)
  const lastFocus = useRef(null)
  const keyHandler = useRef(null)
  const visibilityFrame = useRef(0)
  const wasInactive = useRef(false)
  const rememberedCards = useRef(new Map())
  const inactive = paneOpen || videoView
  const slide = HERO_SLIDES[slideIndex]
  const firstRow = FIRST_ROWS[activeTab]

  useEffect(() => {
    if (paneOpen || videoView || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setSlideIndex(index => (index + 1) % HERO_SLIDES.length), 6000)
    return () => clearInterval(timer)
  }, [paneOpen, videoView])

  useLayoutEffect(() => {
    if (inactive) {
      if (!wasInactive.current) returnFocus.current = rootRef.current?.contains(document.activeElement)
        ? document.activeElement : lastFocus.current
    } else {
      const target = wasInactive.current && isAvailable(returnFocus.current) ? returnFocus.current : heroRef.current
      focusCard(target)
    }
    wasInactive.current = inactive
  }, [inactive])

  // Listen outside the home too: browsers can move focus to body when a tab or
  // overlay changes. The next remote key must still have a route back to a card.
  useLayoutEffect(() => { keyHandler.current = handleKey })
  useEffect(() => {
    const keydown = event => keyHandler.current?.(event)
    document.addEventListener('keydown', keydown, true)
    return () => document.removeEventListener('keydown', keydown, true)
  }, [])

  useLayoutEffect(() => {
    if (inactive) return
    queueVisibility()
    // Keep focus in view throughout the hero's height animation and resizing.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(queueVisibility) : null
    observer?.observe(heroRef.current)
    observer?.observe(feedRef.current)
    return () => {
      observer?.disconnect()
      cancelAnimationFrame(visibilityFrame.current)
    }
  }, [inactive, activeTab])

  function showSlide(index) {
    setSlideIndex((index + HERO_SLIDES.length) % HERO_SLIDES.length)
  }

  function isAvailable(target) {
    return target?.isConnected && rootRef.current?.contains(target) && target.getClientRects().length > 0
  }

  function keepCardVisible(target) {
    const feed = feedRef.current
    if (!isAvailable(target) || !feed?.contains(target)) return
    const scale = rootRef.current.getBoundingClientRect().width / rootRef.current.offsetWidth || 1
    const gap = 12 * scale
    if (target === heroRef.current || target.closest('[data-ug-row="slides"]')) {
      feed.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }
    // Scroll only the rails and feed, never the columns, headings, or page.
    for (let rail = target.closest('[data-ug-rail]'); rail; rail = rail.parentElement.closest('[data-ug-rail]')) {
      const cardRect = target.getBoundingClientRect()
      const railRect = rail.getBoundingClientRect()
      const left = Math.max(railRect.left, feed.getBoundingClientRect().left) + gap
      const right = Math.min(railRect.right, feed.getBoundingClientRect().right) - gap
      const delta = cardRect.left < left ? cardRect.left - left : cardRect.right > right ? cardRect.right - right : 0
      if (delta) rail.scrollTo({ left: rail.scrollLeft + delta / scale, behavior: 'auto' })
    }
    const cardRect = (target.closest('.ug-now-playing') || target).getBoundingClientRect()
    const heading = target.closest('.split-column')?.querySelector('.section-title')
      || target.closest('.section')?.querySelector('.section-title')
    const top = Math.min(cardRect.top, heading?.getBoundingClientRect().top ?? cardRect.top) - gap
    const bottom = cardRect.bottom + gap
    const feedRect = feed.getBoundingClientRect()
    // Include the heading when it fits; taller cards still keep their top visible.
    const delta = top < feedRect.top ? top - feedRect.top
      : bottom > feedRect.bottom ? Math.min(bottom - feedRect.bottom, top - feedRect.top) : 0
    feed.scrollTo({ top: feed.scrollTop + delta / scale, left: 0, behavior: 'auto' })
  }

  function queueVisibility() {
    cancelAnimationFrame(visibilityFrame.current)
    visibilityFrame.current = requestAnimationFrame(() => {
      if (!inactive) keepCardVisible(document.activeElement)
    })
  }

  function focusCard(target) {
    if (!target) return
    target.focus({ preventScroll: true })
    lastFocus.current = target
    keepCardVisible(target)
    queueVisibility()
  }

  function handleKey(event) {
    if (inactive || event.defaultPrevented) return
    if (event.target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return
    const key = tvRemoteKey(event)
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Backspace', 'Tab'].includes(key)) return
    event.preventDefault()
    event.stopPropagation()
    let target = document.activeElement?.closest('[data-ug-focus]')
    if (!isAvailable(target)) {
      target = isAvailable(lastFocus.current) ? lastFocus.current : heroRef.current
      focusCard(target)
      return
    }
    if (key === 'Enter' || key === ' ') { if (!event.repeat) target?.click(); return }
    if (key === 'Escape' || key === 'Backspace') {
      setHeroExpanded(false)
      focusCard(heroRef.current)
      return
    }
    const available = [...rootRef.current.querySelectorAll('[data-ug-focus]')].filter(el => el.getClientRects().length)
    if (key === 'Tab') {
      const index = available.indexOf(target)
      focusCard(available[(index + (event.shiftKey ? -1 : 1) + available.length) % available.length])
      return
    }
    if (target === heroRef.current && ['ArrowLeft', 'ArrowRight'].includes(key)) {
      showSlide(slideIndex + (key === 'ArrowRight' ? 1 : -1)); return
    }
    const row = target?.closest('[data-ug-row]')
    const groups = [...rootRef.current.querySelectorAll('[data-ug-row]')].filter(group => group.dataset.ugRow !== 'slides' &&
      [...group.querySelectorAll('[data-ug-focus]')].some(el => el.getClientRects().length))
    const peers = row ? [...row.querySelectorAll('[data-ug-focus]')].filter(el => el.getClientRects().length) : []
    rememberedCards.current.set(row?.dataset.ugRow, target?.dataset.ugFocus)
    if (row?.dataset.ugRow === 'sidebar' && key === 'ArrowRight') {
      setHeroExpanded(false); focusCard(heroRef.current); return
    }
    if (row?.dataset.ugRow === 'sidebar' && ['ArrowUp', 'ArrowDown'].includes(key)) {
      const index = peers.indexOf(target) + (key === 'ArrowDown' ? 1 : -1)
      focusCard(peers[Math.max(0, Math.min(peers.length - 1, index))]); return
    }
    if (['ArrowLeft', 'ArrowRight'].includes(key)) {
      const index = peers.indexOf(target) + (key === 'ArrowRight' ? 1 : -1)
      if (index < 0 && row?.dataset.ugRow !== 'sidebar') {
        focusCard(rootRef.current.querySelector('[data-ug-focus="rail-home"]'))
      } else focusCard(peers[Math.max(0, Math.min(peers.length - 1, index))])
      return
    }
    const currentIndex = groups.indexOf(row?.dataset.ugRow === 'slides' ? heroRef.current.closest('[data-ug-row="hero"]') : row)
    const nextRow = groups[currentIndex + (key === 'ArrowDown' ? 1 : -1)]
    if (!nextRow) return
    const candidates = nextRow.dataset.ugRow === 'hero' ? [heroRef.current] : [...nextRow.querySelectorAll('[data-ug-focus]')].filter(el => el.getClientRects().length)
    const remembered = rememberedCards.current.get(nextRow.dataset.ugRow)
    const rect = target.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    const closest = candidates.reduce((best, candidate) => {
      const rect = candidate.getBoundingClientRect()
      const distance = Math.abs(rect.left + rect.width / 2 - center)
      return !best || distance < best.distance ? { target: candidate, distance } : best
    }, null)
    const defaultTarget = nextRow.dataset.ugRow === 'tabs'
      ? candidates.find(candidate => candidate.dataset.ugFocus === `tab-${activeTab}`)
      : row?.dataset.ugRow === 'tabs' && nextRow.dataset.ugRow === 'first-row' ? candidates[0] : closest?.target
    setHeroExpanded(nextRow.dataset.ugRow === 'hero')
    focusCard(candidates.find(candidate => candidate.dataset.ugFocus === remembered) || defaultTarget)
  }

  return (
    <section ref={rootRef} className="ug-home app-layout" aria-label="Universal Guide home" inert={paneOpen}
      onFocusCapture={event => {
        const target = event.target.closest('[data-ug-focus]')
        if (target) lastFocus.current = target
        queueVisibility()
      }} onTransitionEnd={queueVisibility}>
      <GuideSidebar />
      <div ref={feedRef} className="ug-feed main-content">
        <div className="hero-shell" data-ug-row="hero">
          <div ref={heroRef} role="button" tabIndex={0} className={`hero-banner ${heroExpanded ? 'expanded' : 'collapsed'}`} data-ug-focus="hero"
            aria-label={slide.id === 'himym' ? slide.title : slide.label}
            data-product-id={slide.id} onClick={() => { if (slide.id !== 'himym') onProductSelect?.(slide.id) }}>
            {HERO_SLIDES.map((item, index) => <div key={item.id} className={`hero-slide ug-theme-${item.theme} ${index === slideIndex ? 'active' : ''}`}>
              <GuideArt item={item} hero className="hero-backdrop" />
              <div className="hero-gradient ug-hero-gradient" />
              <div className="hero-bottom-fade" />
              <div className="hero-content ug-hero-copy"><div className="hero-subtitle">{item.eyebrow}</div>
                <h1>{item.title}</h1><div className="hero-tagline">{item.description}</div><strong>{item.label}</strong></div>
            </div>)}
            <div className="hero-dots" data-ug-row="slides" aria-label="Hero slides">
              {HERO_SLIDES.map((item, index) => <button key={item.id} type="button" className={`hero-dot ${index === slideIndex ? 'active' : ''}`} data-ug-focus={`slide-${item.id}`}
                aria-label={`Show ${item.id === 'himym' ? item.title : item.id}`} aria-pressed={index === slideIndex}
                onClick={event => { event.stopPropagation(); showSlide(index) }} />)}
            </div>
          </div>
        </div>
        <div className="tab-bar-wrapper"><div className="tab-bar" role="tablist" aria-label="Home sections" data-ug-row="tabs">
          {GUIDE_TABS.map(tab => <div key={tab} role="tab" tabIndex={0} className={`tab-item ${activeTab === tab ? 'active' : ''}`} aria-selected={activeTab === tab}
            aria-controls="ug-tab-content" id={`ug-tab-${tab.replaceAll(' ', '-')}`} data-ug-focus={`tab-${tab}`}
            onFocus={() => setActiveTab(tab)} onClick={() => setActiveTab(tab)}>{tab}</div>)}
        </div></div>
        <div id="ug-tab-content" role="tabpanel" className={activeTab === 'For You' ? 'for-you-tab' : activeTab === 'Live' ? 'live-tab' : 'apps-tab'} aria-labelledby={`ug-tab-${activeTab.replaceAll(' ', '-')}`}>
          <section className={`section split-row-section ug-first-row ${activeTab !== 'For You' ? 'ug-hidden-row' : ''}`} aria-label="Now Playing and Recommended for You" data-ug-row="first-row">
            <div className="split-row-container">
              <div className="split-column split-column-left"><h2 className="section-title split-section-title">Now Playing</h2>
                <div className="content-row" data-ug-rail>
                  <div className="content-card landscape-card ug-now-playing"><div className="card-poster-wrap ug-video-tile">{nowPlaying}
                    <button type="button" className="ug-video-launch" data-ug-focus="now-playing" aria-label="Now Playing — open video view" onClick={onOpenVideo} />
                  </div><div className="card-info always-visible"><div className="card-title">Now Playing</div><div className="card-platform-logo">Press OK to watch</div></div></div>
                </div>
              </div><div className="split-divider" />
              <section className="split-column split-column-right" aria-label="Recommended for You"><h2 className="section-title split-section-title">Recommended for You</h2>
                <GuideCards row={FIRST_ROWS['For You']} />
              </section>
            </div>
          </section>
          {activeTab !== 'For You' && <GuideRow row={firstRow} />}
          {GUIDE_ROWS[activeTab].map(row => <GuideRow key={`${activeTab}-${row.id}`} row={row} />)}
          <div className="scroll-top-section" data-ug-row="back-top">
            <div role="button" tabIndex={0} className="scroll-top-btn" aria-label="Back to top" data-ug-focus="back-top" onClick={() => {
              setHeroExpanded(false); focusCard(heroRef.current)
            }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg><span>Back to top</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}
