import { providerId, PROVIDERS } from './providers.js'

// The backend owns executable checkout/cancel choices. An empty top-level
// actions array may accompany genuine choices in payload.actions.
export function checkoutActionLabels(envelope) {
  const topLevel = Array.isArray(envelope?.actions) ? envelope.actions : []
  const nested = Array.isArray(envelope?.payload?.actions) ? envelope.payload.actions : []
  const labels = topLevel.length ? topLevel : nested
  return labels.map(value => String(value ?? '').trim()).filter(Boolean)
}

// This fallback only asks for available buttons. Never send "checkout" or
// "cancel order" as an invented command: those can mutate/payment an order.
export function checkoutOptionsRequest(platform, vertical = 'food') {
  const id = providerId(platform, vertical)
  if (!id) return ''
  const name = PROVIDERS[id].label
  return `Read my current ${name} provider cart without changing it. Show its items and current total, and return any available checkout / decline choices in the structured actions list so I can decide on the TV. This is a read-only inquiry. Do not add, remove or change items. Do NOT submit checkout, pay, place an order, or cancel an existing order. If the provider cannot supply checkout options, state that plainly.`
}
