export const UPI_QR = 'upi_qr'
export const CONFIRM = 'confirm'

const QR_PLATFORMS = ['zomato']

export function payModeFor(platform) {
  const name = String(platform || '')
    .trim()
    .toLowerCase()

  // Matched as a prefix so "Zomato" and any "Zomato …" variant both count,
  // while "Swiggy Instamart" never does.
  return QR_PLATFORMS.some(
    (p) =>
      name === p ||
      name.startsWith(`${p} `),
  )
    ? UPI_QR
    : CONFIRM
}

export function showsUpiQr(platform) {
  return payModeFor(platform) === UPI_QR
}

/** Payment evidence from the order wins over a platform-level expectation. */
export function paymentPresentation({ platform, payment, qr } = {}) {
  if (qr) return 'qr'
  const detail = typeof payment === 'object' && payment !== null
    ? payment.label || payment.name || payment.method || payment.mode || payment.type || payment.payment_method || ''
    : payment
  const method = String(detail || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  const cash = /\b(cod|cash|pay on delivery)\b/.test(method)
  const online = /\b(upi|online|prepaid|qr)\b/.test(method)
  if (cash && online) return 'unknown'
  if (cash) return 'cod'
  if (online) return 'qr'
  if (showsUpiQr(platform)) return 'qr'
  return 'unknown'
}

export function paymentMethodFromEnvelope(envelope) {
  const payload = envelope?.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
  const order = payload.order && typeof payload.order === 'object' ? payload.order : {}
  const rawTracking = envelope?.tracking || payload.tracking
  const tracking = rawTracking && typeof rawTracking === 'object' ? rawTracking : {}
  return envelope?.payment_method || envelope?.payment ||
    payload.payment_method || payload.payment ||
    data.payment_method || data.payment ||
    order.payment_method || order.payment ||
    tracking.payment_method || tracking.payment || ''
}

/** A COD-only response is confirmation only with explicit order evidence. */
export function confirmedCodCheckout(envelope) {
  if (paymentPresentation({ payment: paymentMethodFromEnvelope(envelope) }) !== 'cod') return false
  const payload = envelope?.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
  const order = payload.order && typeof payload.order === 'object' ? payload.order : {}
  const orderId = envelope?.order_id || payload.order_id || data.order_id || order.order_id
  const rawStatus = envelope?.order_status || payload.order_status || data.order_status ||
    order.order_status || envelope?.status || payload.status || data.status || order.status
  const status = String(rawStatus || '').replace(/[_-]/g, ' ').toLowerCase()
  if (/\b(not|pending|failed|cancelled|canceled)\b/.test(status)) return false
  return Boolean(orderId && /\b(placed|confirmed|accepted|preparing|completed|success)\b/.test(status))
}

/** The order's platform, from whichever part of the journey knows it. */
export function orderPlatform({
  cart,
  groceryCard,
  restaurant,
  tracking,
} = {}) {
  return (
    tracking?.platform ||
    cart?.platform ||
    cart?.store ||
    groceryCard?.platform ||
    restaurant?.platform ||
    ''
  )
}
