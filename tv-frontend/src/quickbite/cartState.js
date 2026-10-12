import { cartFromEnvelope, trackingFromEnvelope, paymentQrFromEnvelope } from './envelopes.js'
import { confirmedCodCheckout } from './payMode.js'
import { providerId, PROVIDERS } from './providers.js'

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


// A checkout decline is not a provider-cart deletion. Provider clearing must
// explicitly name the merchant and verify the cart after the mutation.
export function cartClearRequestPrompt(platform, vertical = 'food') {
  const id = providerId(platform, vertical)
  if (!id) return ''
  const label = PROVIDERS[id].label
  return `Clear the current ${label} provider cart by removing every item and quantity. This is an explicit provider cart-clear operation, NOT a checkout decline. Do not place an order, pay, or cancel an already placed order. If removal is unsupported or fails, say so and leave the cart unchanged. Return the updated cart's item list and total.`
}
export function cartReadbackPrompt(platform, vertical = 'food') {
  const id = providerId(platform, vertical)
  if (!id) return ''
  return `Show my current ${PROVIDERS[id].label} provider cart now, reading the provider's actual cart state. Read-only verification: do not add, remove, checkout, pay, or place an order. Return a structured cart with its items (including an empty array when empty) and total.`
}
// Never retire the local cart because a conversational text response claimed
// "cart cleared". Require the provider readback to contain items:[] and total:0.
export function verifiedEmptyCart(envelope) {
  if (!cartClearConfirmed(envelope)) return false
  const payload = envelope?.payload || {}
  const source = payload.cart || payload.data || payload
  const lines = source.items ?? source.cart_items ?? source.lines
  const total = source.total ?? source.grand_total
  return Array.isArray(lines) && total != null && Number(total) === 0
}
