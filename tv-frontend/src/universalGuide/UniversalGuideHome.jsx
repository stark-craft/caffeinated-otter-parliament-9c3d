import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { tvRemoteKey } from '../tizen/tvRemoteKeys.js'
import { APP_TILES, GUIDE_TABS, HERO_SLIDES } from './catalog.js'

function Art({ slide }) {
  return <img src={slide.image} alt="" onError={event => {
    if (slide.fallback && !event.currentTarget.dataset.fallback) {
      event.currentTarget.dataset.fallback = 'true'
      event.currentTarget.src = slide.fallback
    }
  }} />
}

export default function UniversalGuideHome({ paneOpen, onProductSelect, onOpenShop, nowPlaying }) {
  const [activeTab, setActiveTab] = useState('For You')
  const [slideIndex, setSlideIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const rootRef = useRef(null)
  const heroRef = useRef(null)
  const returnFocus = useRef(null)
  const wasOpen = useRef(false)
  const slide = HERO_SLIDES[slideIndex]
  useEffect(() => {
    if (paneOpen || paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setSlideIndex(index => (index + 1) % HERO_SLIDES.length), 6000)
    return () => clearInterval(timer)
  }, [paneOpen, paused])
  useLayoutEffect(() => {
    if (paneOpen) {
      if (rootRef.current?.contains(document.activeElement)) returnFocus.current = document.activeElement
    } else {
      const target = wasOpen.current && returnFocus.current?.isConnected ? returnFocus.current : heroRef.current
      target?.focus({ preventScroll: true })
    }
    wasOpen.current = paneOpen
  }, [paneOpen])

  function activateProduct(id) {
    if (id === 'himym') return
    onProductSelect?.(id)
  }
  function showSlide(index) {
    setPaused(true)
    setSlideIndex((index + HERO_SLIDES.length) % HERO_SLIDES.length)
  }
  function handleKey(event) {
    if (paneOpen) return
    const key = tvRemoteKey(event)
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape', 'Backspace', 'Tab'].includes(key)) return
    event.preventDefault()
    event.stopPropagation() // The unchanged player owns media keys and panel keys, not home navigation.
    setPaused(true)
    const target = document.activeElement
    if (key === 'Enter' || key === ' ') { if (!event.repeat) target?.click(); return }
    if (key === 'Escape' || key === 'Backspace') { heroRef.current?.focus(); return }
    const buttons = [...rootRef.current.querySelectorAll('[data-ug-focus]')]
    const available = buttons.filter(el => el.getClientRects().length)
    if (key === 'Tab') {
      const index = available.indexOf(target)
      available[(index + (event.shiftKey ? -1 : 1) + available.length) % available.length]?.focus()
      return
    }
    if (target === heroRef.current && ['ArrowLeft', 'ArrowRight'].includes(key)) {
      showSlide(slideIndex + (key === 'ArrowRight' ? 1 : -1)); return
    }
    const row = target?.closest('[data-ug-row]')
    const groups = [...rootRef.current.querySelectorAll('[data-ug-row]')]
    const rowIndex = groups.indexOf(row)
    const peers = row ? [...row.querySelectorAll('[data-ug-focus]')] : []
    if (['ArrowLeft', 'ArrowRight'].includes(key)) {
      peers[Math.max(0, Math.min(peers.length - 1, peers.indexOf(target) + (key === 'ArrowRight' ? 1 : -1)))]?.focus()
    } else {
      const next = groups[rowIndex + (key === 'ArrowDown' ? 1 : -1)]
      const candidates = next ? [...next.querySelectorAll('[data-ug-focus]')] : []
      candidates[Math.min(Math.max(peers.indexOf(target), 0), candidates.length - 1)]?.focus()
    }
  }

  return (
    <section ref={rootRef} className="ug-home" aria-label="Universal Guide home" inert={paneOpen}
      onKeyDownCapture={handleKey}>
      <nav className="ug-sidebar" aria-label="TV home menu">
        <div className="ug-profile" aria-label="TV profile">◉</div>
        <span title="Search">⌕</span><span title="Ambient">▧</span><span title="Daily+">▦</span>
        <span className="ug-home-icon" title="Home">⌂</span>
        <div className="ug-sidebar-bottom"><span title="Connected devices">▣</span><span title="Settings">⚙</span></div>
      </nav>
      <div className="ug-feed">
        <div className={`ug-hero ug-theme-${slide.theme}`} data-ug-row="hero">
          <button ref={heroRef} type="button" className="ug-hero-slide" data-ug-focus="hero"
            aria-label={slide.id === 'himym' ? slide.title : `Explore ${slide.id === 'chips' ? 'Lay’s chips' : 'milk'}`}
            data-product-id={slide.id} onClick={() => activateProduct(slide.id)}>
            <Art key={slide.id} slide={slide} />
            <div className="ug-hero-wash" />
            <div className="ug-hero-copy"><span>{slide.eyebrow}</span><h1>{slide.title}</h1>
              <p>{slide.description}</p><strong>{slide.label}</strong></div>
          </button>
          <div className="ug-hero-dots" data-ug-row="slides" aria-label="Hero slides">
            {HERO_SLIDES.map((item, index) => <button key={item.id} type="button" data-ug-focus={`slide-${item.id}`}
              aria-label={`Show ${item.id === 'himym' ? item.title : item.id}`} aria-pressed={index === slideIndex}
              onClick={() => showSlide(index)}><span /></button>)}
          </div>
        </div>
        <div className="ug-tabs" role="tablist" aria-label="Home sections" data-ug-row="tabs">
          {GUIDE_TABS.map(tab => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab}
            aria-controls="ug-tab-content" id={`ug-tab-${tab.replaceAll(' ', '-')}`} data-ug-focus={`tab-${tab}`}
            onFocus={() => setActiveTab(tab)} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>
        <div id="ug-tab-content" role="tabpanel" aria-labelledby={`ug-tab-${activeTab.replaceAll(' ', '-')}`}>
          {/* Always the same mounted player, including on tab changes and during pairing. */}
          <div className="ug-first-row" data-ug-row="first-row">
            <div className="ug-now-playing"><h2>Now Playing</h2>
              <div className="ug-video-tile">{nowPlaying}</div>
              <button type="button" className="ug-now-action" data-ug-focus="quick-shop" onClick={onOpenShop}>Open Quick Shop <span>›</span></button>
            </div>
            <div className="ug-recommendations"><h2>{activeTab === 'For You' ? 'Recommended for You' : activeTab === 'Live' ? 'On Now' : 'Recommended Apps'}</h2>
              <div className="ug-card-row">
                {activeTab === 'Apps' ? APP_TILES.slice(0, 3).map((app, index) => <button key={app} type="button"
                  className={`ug-app-card ug-app-${index}`} data-ug-focus={`app-${index}`}>
                  <span>{app}</span><small>Entertainment</small></button>) : HERO_SLIDES.map(item => <button key={item.id} type="button"
                  className={`ug-content-card ug-theme-${item.theme}`} data-ug-focus={`card-${item.id}`} onClick={() => activateProduct(item.id)}>
                  <Art slide={item} /><span>{item.id === 'himym' ? (activeTab === 'Live' ? 'Featured entertainment' : item.title) : item.id === 'milk' ? 'Everyday essentials' : 'Movie-night snacks'}</span>
                  <small>{item.id === 'himym' ? 'Entertainment' : 'Quick Shop · Grocery'}</small></button>)}
              </div>
            </div>
          </div>
          <div className="ug-app-strip" data-ug-row="apps" aria-label="App shortcuts">
            {APP_TILES.map((app, index) => <button type="button" key={app} data-ug-focus={`shortcut-${index}`}>
              <span className={`ug-app-mark ug-app-${index}`}>{app === 'Samsung TV Plus' ? 'TV+' : app[0]}</span><small>{app}</small></button>)}
          </div>
          <div className="ug-secondary-row"><h2>{activeTab === 'Live' ? 'Trending channels' : activeTab === 'Apps' ? 'Discover apps' : 'Made for your evening'}</h2>
            <p>{activeTab === 'Live' ? 'Entertainment · Sports · News' : activeTab === 'Apps' ? 'Entertainment · Music · Lifestyle' : 'Your shows, everyday essentials and favourite snacks.'}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
