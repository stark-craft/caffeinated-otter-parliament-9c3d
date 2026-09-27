import './PlatformBadge.css'

const BRANDS = [
  { match: /instamart/i, kind: 'instamart', mark: 'S' },
  { match: /zomato/i, kind: 'zomato', mark: 'z' },
  { match: /swiggy/i, kind: 'swiggy', mark: 'S' },
  { match: /zepto/i, kind: 'zepto', mark: 'z' },
]

export default function PlatformBadge({ platform, compact = false }) {
  const value = String(platform || '').trim()
  const brand = BRANDS.find(({ match }) => match.test(value))
  const label = value || 'Unknown platform'

  return (
    <span className={`qb-platform-badge qb-platform-${brand?.kind || 'unknown'}${compact ? ' is-compact' : ''}`} aria-label={`Platform: ${label}`}>
      <span className="qb-platform-mark" aria-hidden="true">{brand?.mark || '?'}</span>
      <span className="qb-platform-name">{label}</span>
    </span>
  )
}
