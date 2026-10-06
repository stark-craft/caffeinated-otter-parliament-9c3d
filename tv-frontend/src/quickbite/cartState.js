import { cartFromEnvelope, trackingFromEnvelope, paymentQrFromEnvelope } from './envelopes.js'
import { confirmedCodCheckout } from './payMode.js'

// A destructive label authorizes a request, not a local clear. Require the
// reply to confirm an empty cart or explicitly report that the cart was cleared.
// A checkout decline, failed request or placed order is a different outcome.
export function cartClearConfirmed(envelope) {
  const payload = envelope?.payload || {}
  const text = [envelope?.text, payload.message, payload.title, payload.status].filter(Boolean).join(' ')
  if (envelope?.error || payload.error || /\b(?:unable|failed|cannot|could not|not cleared|not cancelled|not canceled|pending)\b/i.test(text)) return false
  if (trackingFromEnvelope(envelope) || confirmedCodCheckout(envelope) ||
      paymentQrFromEnvelope(envelope, { allowImageFallback: false }) || envelope?.order_id || payload.order_id) return false
  const source = payload.cart || payload.data || payload
  const lines = source.items ?? source.cart_items ?? source.lines
  const cart = cartFromEnvelope(envelope)
  if (cart && Array.isArray(lines)) return lines.length === 0 && !Number(cart.total || 0)
  return /\bcart[_\s]+(?:cleared|cancelled|canceled|emptied)\b|\bcart\s+(?:(?:has been|was|is|successfully)\s+)*(?:cleared|cancelled|canceled|emptied)\b|\b(?:cleared|cancelled|canceled|emptied)\s+(?:your|the)\s+cart\b/i.test(text)
}
