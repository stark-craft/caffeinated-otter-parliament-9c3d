export const PROVIDERS = {
  zomato: { label: 'Zomato', merchant: 'zomato', vertical: 'food' },
  swiggy_food: { label: 'Swiggy Food', merchant: 'swiggy', vertical: 'food' },
  swiggy_instamart: { label: 'Swiggy Instamart', merchant: 'swiggy', vertical: 'grocery' },
  zepto: { label: 'Zepto', merchant: 'zepto', vertical: 'grocery' },
}

const GROCERY = /\b(?:groceries|grocery|ingredients?|recipe|instamart|zepto|kirana|diet chart)\b|ग्रोसरी|किराना/u
const REFERENCE = /\b(?:this|these|those|it|same|first|second|third|fourth|cheaper|cheapest)\b|\bthat(?:\s+(?:one|restaurant|store|item|product|dish)\b|[.!?]*$)|\b(?:one|two|three|four|five|\d{1,2})\s+more\b|पहला|दूसरा|इसे/u

export function providerId(value, vertical = 'food') {
  const name = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (/^zomato(?:\s|$)/u.test(name)) return 'zomato'
  if (/^zepto(?:\s|$)/u.test(name)) return 'zepto'
  if (/instamart/u.test(name)) return 'swiggy_instamart'
  if (/^swiggy(?:\s|$)/u.test(name)) return /\bfood\b/u.test(name) || vertical !== 'grocery' ? 'swiggy_food' : 'swiggy_instamart'
  return null
}

export function requestedProviders(utterance) {
  const text = String(utterance || '').toLowerCase()
    .replace(/\b(?:not|without|except|avoid|instead of|don't use|do not use)\s+(?:zomato|swiggy(?: food| instamart)?|instamart|zepto)\b/gu, '')
  const result = []
  if (/\bzomato\b/u.test(text)) result.push('zomato')
  if (/\binstamart\b/u.test(text)) result.push('swiggy_instamart')
  if (/\bswiggy food\b/u.test(text) || (/\bswiggy\b/u.test(text) && !/\binstamart\b/u.test(text))) {
    result.push(/\bswiggy food\b/u.test(text) || !GROCERY.test(text) ? 'swiggy_food' : 'swiggy_instamart')
  }
  if (/\bzepto\b/u.test(text)) result.push('zepto')
  return result
}

export function searchJourney(utterance, view) {
  const text = String(utterance || '').toLowerCase()
  const providers = requestedProviders(text)
  const continuation = !providers.length && REFERENCE.test(text) && !GROCERY.test(text)
  const verticals = [...new Set(providers.map(id => PROVIDERS[id].vertical))]
  const vertical = verticals.length === 1 ? verticals[0]
    : GROCERY.test(text) ? 'grocery'
      : continuation ? view?.vertical || 'food' : 'food'
  return { kind: continuation ? 'continuation' : 'new-search', vertical, providers }
}

// Attribution uses normalized provider fields, never text, artwork or URLs.
export function responseProviders(envelope) {
  const payload = envelope?.payload || {}
  const vertical = (payload.kind || payload.data?.kind) === 'grocery' || ['basket', 'basket_stocked'].includes(envelope?.widget) ? 'grocery' : 'food'
  const found = new Set()
  // A bare Swiggy label is ambiguous: prefer any explicit Food/Instamart label.
  let bareSwiggy = false
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 6) return
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => visit(item, depth + 1)); return }
    for (const key of ['platform', 'server', 'provider']) {
      if (/^\s*swiggy\s*$/iu.test(String(value[key] || ''))) {
        bareSwiggy = true
        continue
      }
      const id = providerId(value[key], vertical)
      if (id) found.add(id)
    }
    for (const key of ['payload', 'data', 'card', 'restaurant', 'cards', 'restaurants', 'results', 'item', 'items', 'product', 'products', 'menu', 'cart', 'cart_items', 'lines', 'entries', 'platforms', 'tracking', 'order']) visit(value[key], depth + 1)
  }
  visit(envelope)
  const widgetProvider = providerId(envelope?.vendor_widget?.server, vertical)
  if (widgetProvider) found.add(widgetProvider)
  if (bareSwiggy && !found.has('swiggy_food') && !found.has('swiggy_instamart')) {
    found.add(providerId('swiggy', vertical))
  }
  return [...found]
}

export function providerResponseProblem(intent, envelope) {
  const requested = intent?.slots?.providers || []
  if (!requested.length) return null
  const returned = responseProviders(envelope)
  const labels = ids => ids.map(id => PROVIDERS[id]?.label || id).join(' and ')
  const text = [...new Set([
    envelope?.text, envelope?.payload?.title, envelope?.payload?.message,
    envelope?.payload?.data?.message,
  ].filter(Boolean))].join(' ')
  // Authentication failures may offer alternative providers in actions. They
  // must reopen the *requested* provider's QR, not show those alternatives as
  // ordinary search results or report a misleading provider mismatch.
  const loginFailure = /not\s+(?:logged[ -]?in|connected|authenticated|authorized)|login\s+required|sign[ -]?in\s+required|(?:unavailable|not available)\s+in\s+this\s+session|connect\s+(?:your|the)\s+(?:merchant|provider)/iu.test(text)
  const mentioned = requestedProviders(text)
  if (requested.length === 1 && loginFailure &&
      (!mentioned.length || mentioned.includes(requested[0]))) {
    return { kind: 'provider-unavailable', provider: requested[0],
      message: text.trim() || `Connect ${labels(requested)} to continue.` }
  }
  if (returned.some(id => !requested.includes(id))) {
    return { kind: 'provider-mismatch', provider: requested.length === 1 ? requested[0] : null,
      message: `${labels(requested)} was requested, but the backend returned ${labels(returned)}. Check the requested merchant connection or retry the search.` }
  }
  return null
}
