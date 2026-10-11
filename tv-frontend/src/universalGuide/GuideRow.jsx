import GuideArt from './GuideArt.jsx'
import GuideMediaOutput from './GuideMediaOutput.jsx'

function FocusCard({ item, row, className, style, children }) {
  const index = row.cards.indexOf(item)
  const repeatedId = row.cards.some((card, cardIndex) => card.id === item.id && cardIndex !== index)
  const focusId = `${row.id}-${item.id}${repeatedId ? `-${index}` : ''}`
  return <div role="button" tabIndex={0} aria-label={item.title || `App icon ${row.cards.indexOf(item) + 1}`}
    className={className} style={style} onFocus={event => {
      if (!row.kind.startsWith('promo') && row.kind !== 'sports') return
      const card = event.currentTarget
      const rail = card.closest('[data-ug-rail]')
      if (!rail) return
      requestAnimationFrame(() => {
        const cardRect = card.getBoundingClientRect()
        const railRect = rail.getBoundingClientRect()
        const home = card.closest('.ug-home')
        const scale = home.getBoundingClientRect().width / home.offsetWidth
        rail.scrollTo({ left: Math.max(0, rail.scrollLeft + (cardRect.left - railRect.left - (railRect.width - cardRect.width) / 2) / scale), behavior: 'auto' })
      })
    }} data-ug-focus={focusId}>{children}</div>
}

function PlatformLogo({ item, className = 'card-platform-logo', style }) {
  return <div className={className} style={style}>{item.logo
    ? <GuideArt item={item.logo} style={{ height: 14, opacity: .9 }} />
    : <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{item.platform}</span>}</div>
}

function CardMeta({ item }) {
  return <div className="card-meta">
    <span className="card-meta-free">Free with subscription</span><span className="card-meta-separator">|</span>
    <span className="card-meta-item">{item.rating}</span><span className="card-meta-separator">|</span>
    <span className="card-meta-item">{item.year}</span><span className="card-meta-separator">|</span>
    <span className="card-meta-item">{item.resolution}</span><span className="card-meta-separator">|</span>
    <span className="card-meta-imdb"><span className="imdb-badge">IMDb</span><span className="card-meta-item">{item.imdbRating}</span></span>
  </div>
}

function ContentInfo({ item, row, className = 'card-info' }) {
  return <div className={className}>
    <div className={`card-title ${row.boldTitle === false ? 'not-bold' : ''}`}>{item.title}</div>
    <PlatformLogo item={item} />
    {row.showMeta !== false && item.imdbRating && <CardMeta item={item} />}
    {row.showProgress && <div className="card-meta"><span className="card-meta-item">{item.rating}</span>
      <span className="card-meta-separator">|</span><span className="card-meta-item">{item.year}</span></div>}
  </div>
}

export function GuideAppIcon({ item, row, atf = false }) {
  const tile = { width: item.tileWidth || undefined, height: item.tileHeight || undefined,
    background: item.tileBg || item.color || '#fff', borderRadius: '50%', padding: `${item.tilePadding ?? 8}px`,
    overflow: 'hidden', border: item.tileBorder || '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const logo = { width: item.logoWidth || '76%', height: item.logoHeight || '76%', objectFit: item.logoFit || 'contain',
    borderRadius: item.logoRadius ?? 0, filter: item.logoFilter || 'none', transform: `translate(${item.logoTranslateX || '0px'}, ${item.logoTranslateY || '0px'}) scale(${item.logoScale ?? 1})`, transformOrigin: 'center', display: 'block' }
  return <FocusCard item={item} row={row} className={`app-icon ${atf ? 'atf' : ''}`}>
    <div className="app-icon-img" style={tile}><span className="ug-logo-fallback" aria-hidden="true">{item.title.slice(0, 1)}</span>
      {item.image && <GuideArt item={item} style={logo} />}</div><div className="app-icon-label">{item.title}</div>
  </FocusCard>
}

export function GuideCard({ item, row }) {
  if (['app-icon', 'app-strip', 'app-recommended'].includes(row.kind)) return <GuideAppIcon item={item} row={row} />
  if (row.kind === 'genre') return <FocusCard item={item} row={row} className="genre-card" style={{ background: item.color }}><div className="genre-card-name">{item.title}</div></FocusCard>
  if (row.kind === 'app-screenshot') return <FocusCard item={item} row={row} className="ec-card">
    <div className="ec-card-img-wrap"><GuideArt item={item} className="ec-card-img" /><div className="ec-card-overlay" /></div>
    <div className="ec-card-bottom">{item.logo && <GuideArt item={item.logo} className="ec-card-logo" />}<span className="ec-card-name">{item.title}</span>{item.type && <span className="ec-card-type">{item.type}</span>}</div>
  </FocusCard>
  if (['promo-simple', 'promo-app'].includes(row.kind)) return <FocusCard item={item} row={row} className="promo-card">
    <div className="promo-card-img-wrap"><GuideArt item={item} className="promo-card-img" /><div className="promo-card-overlay" /><div className="promo-badge">SPONSORED</div></div>
    {row.kind === 'promo-simple' ? <div className="promo-card-info promo-simple-card-info"><div className="promo-card-title">{item.title}</div>
      <div className="promo-simple-focus-row"><span className={`promo-simple-platform-logo ${item.logo ? '' : 'fallback'}`}>{item.logo ? <GuideArt item={item.logo} /> : item.platform.slice(0, 1)}</span><span className="promo-simple-action-text">{item.focusLabel}</span></div>
    </div> : <div className="promo-card-bottom"><div className="promo-card-app-row promo-card-app-row-no-status">
      {item.logo ? <GuideArt item={item.logo} className="promo-card-app-logo promo-card-app-logo-large" /> : <div className="promo-card-app-logo-fallback promo-card-app-logo-fallback-large">{item.platform.slice(0, 1)}</div>}
      <span className="promo-card-app-name promo-card-app-name-large">{item.platform}</span></div></div>}
  </FocusCard>
  if (['live', 'sports'].includes(row.kind)) return <FocusCard item={item} row={row} className={`live-card ${row.kind === 'sports' ? 'live-sports-card' : ''}`}>
    <div className="live-card-img-wrap"><GuideArt item={item} className="live-card-img" /><div className="live-card-overlay" />
      {row.kind === 'live' && item.logo && <GuideArt item={item.logo} className="live-card-channel-logo" />}
      {(row.kind === 'live' || item.isLive) && <div className="live-badge">● LIVE</div>}
      {item.statusLabel === 'UPCOMING' && <div className="live-badge upcoming-badge">UPCOMING</div>}
      {row.kind === 'live' && <><div className="live-card-time-left">{item.timeLeft}</div>
        {item.progress !== undefined && <div className="live-progress-track"><div className="live-progress-fill" style={{ width: `${item.progress}%` }} /></div>}</>}
    </div>
    <div className="live-card-info">{row.kind === 'live' && <div className="live-card-channel-name">{item.channel} • {item.channelNo}</div>}
      <div className="live-card-program">{row.kind === 'live' ? item.program : `${item.teamA} vs ${item.teamB}`}</div>
      <div className="live-card-time">{row.kind === 'live' ? item.time : `${item.date} • ${item.time} • ${item.venue}`}</div>
      {row.kind === 'sports' && <><div className="card-meta" style={{ marginTop: 6 }}>
        <span className="card-meta-free">Free with subscription</span><span className="card-meta-separator">|</span><span className="card-meta-item">{item.rating}</span>
        <span className="card-meta-separator">|</span><span className="card-meta-item">{item.year}</span><span className="card-meta-separator">|</span><span className="card-meta-item">{item.resolution}</span>
      </div><PlatformLogo item={item} style={{ marginTop: 4 }} /></>}
    </div>
  </FocusCard>
  if (row.kind === 'imdb') return <FocusCard item={item} row={row} className="imdb-card">
    <div className="imdb-rank">{item.rank}</div><div><div className="imdb-card-poster-wrap"><GuideArt item={item} className="imdb-card-poster" /></div><ContentInfo item={item} row={row} className="imdb-card-info" /></div>
  </FocusCard>
  return <FocusCard item={item} row={row} className={`content-card ${row.kind === 'landscape' ? 'landscape-card' : ''}`}>
    <div className="card-poster-wrap"><GuideArt item={item} className="card-poster" />
      {row.showProgress && item.progress && <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${item.progress}%` }} /></div>}
    </div><ContentInfo item={item} row={row} />
  </FocusCard>
}

export function GuideCards({ row }) {
  return <div className={`content-row ${row.kind === 'imdb' ? 'imdb-top10-row' : ''} ${row.kind.startsWith('promo') ? 'promo-content-row' : ''}`} data-ug-rail>
    {row.cards.map((item, index) => <GuideCard key={`${item.id}-${index}`} item={item} row={row} />)}
  </div>
}

export default function GuideRow({ row }) {
  if (row.kind === 'media') return <GuideMediaOutput />
  if (row.kind === 'app-strip') return <section className="section" aria-label="Apps" data-ug-row={row.id}>
    <div className="app-strip-container" data-ug-rail><div className="app-strip-atf">
      {row.cards.slice(0, row.atfCount).map(item => <GuideAppIcon key={item.id} item={item} row={row} atf />)}
    </div><div className="app-strip-divider" /><div className="app-strip-btf-scroll" data-ug-rail>
      {row.cards.slice(row.atfCount).map(item => <GuideAppIcon key={item.id} item={item} row={row} />)}
    </div></div></section>
  if (row.kind === 'app-recommended') return <section className="section" aria-label="Recommended by Samsung" data-ug-row={row.id}>
    <div className="recommended-row" data-ug-rail><div className="recommended-label">Recommended</div><div className="recommended-apps">
      {row.cards.slice(0, 3).map(item => <GuideAppIcon key={item.id} item={item} row={row} />)}
    </div><div className="recommended-divider" /><div className="recommended-provider">Provided by Samsung</div><div className="recommended-samsung-apps">
      {row.cards.slice(3).map(item => <GuideAppIcon key={item.id} item={item} row={row} />)}
    </div></div></section>
  const shell = row.kind === 'promo-simple' ? 'promo-row-shell simple-mode' : row.kind === 'promo-app' ? 'promo-row-shell app-spotlight-mode' : row.kind === 'sports' ? 'live-sports-row-shell' : ''
  return <section className={`section ${shell} ${row.kind === 'imdb' ? 'imdb-top10-section' : ''}`} aria-label={row.title} data-ug-row={row.id}>
    <div className={shell ? 'promo-row-content' : undefined}><div className="section-header"><h2 className="section-title">{row.kind === 'imdb' && <span className="imdb-badge" style={{ fontSize: 11, padding: '2px 5px', marginRight: 8 }}>IMDb</span>}{row.title}</h2></div>
      <GuideCards row={row} /></div>
  </section>
}
