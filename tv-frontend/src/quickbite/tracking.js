import { providerId } from './providers.js'
import { paymentPresentation } from './payMode.js'

const PREPARING = [
  'placed',
  'in the kitchen',
  'preparing',
  'rider assigned',
]

const TRAVELLING = [
  'at the restaurant',
  'on the way',
  'at your door',
  'out for delivery',
]

export function trackingText(snapshot) {
  return String(
    snapshot?.step ||
      snapshot?.order_status ||
      snapshot?.status ||
      snapshot?.title ||
      snapshot?.message ||
      '',
  ).trim()
}

export function trackingPhase(snapshot) {
  if (!snapshot) return 'unknown'

  const text = trackingText(snapshot).toLowerCase()

  if ([snapshot.step, snapshot.order_status, snapshot.status, snapshot.title, snapshot.message]
      .some(value => /\b(cancelled|canceled)\b/i.test(String(value || '')))) return 'cancelled'

  if (paymentPending(snapshot)) return 'pay'

  if (/\bdelivered\b|\bdelivery complete(?:d)?\b/.test(text) || snapshot.done === true) {
    return 'delivered'
  }

  if (TRAVELLING.some((step) => text.includes(step))) {
    return 'on-the-way'
  }

  if (PREPARING.some((step) => text.includes(step))) {
    return 'preparing'
  }

  if (
    text.includes('confirming payment') ||
    text.includes('payment pending') ||
    text.includes('awaiting payment')
  ) {
    return 'pay'
  }

  return 'unknown'
}

export function paymentPending(snapshot) {
  return [snapshot?.order_status, snapshot?.status, snapshot?.step].some(value =>
    /\b(?:confirming payment|payment (?:is )?incomplete|payment pending|awaiting payment|unpaid)\b/i.test(String(value || '')))
}

export function reconcileTrackingSnapshot(previous, next, { descriptor, payment } = {}) {
  const prior = previous || descriptor
  const priorPhase = trackingPhase(prior)
  const provider = providerId(prior?.platform || prior?.server || descriptor?.platform || descriptor?.server,
    prior?.kind || descriptor?.kind)
  // The reproduced Instamart COD contract uses this explicit shape to report
  // no active order. Generic empty/waiting responses and other providers do
  // not establish a cancellation. Reconcile before monotonic progression.
  if (provider === 'swiggy_instamart' && prior?.order_id &&
      (!descriptor?.order_id || descriptor.order_id === prior.order_id) &&
      ['preparing', 'on-the-way'].includes(priorPhase) &&
      paymentPresentation({ payment: payment || prior.payment || prior.payment_method || descriptor?.payment || descriptor?.payment_method }) === 'cod' &&
      (next.active_order_absent === true || !Object.hasOwn(next, 'active_order_absent')) &&
      next.waiting === true && next.order_id === null && next.step === null &&
      next.done === false && trackingPhase(next) === 'unknown' && !next.error && !next.stale) {
    return { ...prior, ...next, order_id: prior.order_id, step: 'Cancelled', order_status: 'Cancelled',
      status: 'Cancelled', done: true, payment_qr: null, reconciliation: 'active-order-disappeared',
      message: next.message || 'The provider no longer reports this order as active.' }
  }
  const phase = trackingPhase(next)
  if (previous && trackingPhaseRank(phase) < trackingPhaseRank(trackingPhase(previous)) &&
      phase !== 'cancelled' && !paymentPending(next)) {
    return { ...next, step: previous.step, status: previous.status, order_status: previous.order_status,
      title: previous.title, message: next.message || previous.message, done: previous.done }
  }
  return next
}

export async function withTrackingTimeout(request, milliseconds = 8000) {
  let timer
  try {
    return await Promise.race([request, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Payment/order status did not respond. Check again or open the existing order in the provider app.')), milliseconds)
    })])
  } finally { clearTimeout(timer) }
}

export const PHASE_RANK = {
  unknown: 0,
  pay: 1,
  preparing: 2,
  'on-the-way': 3,
  delivered: 4,
  cancelled: 99,
}

export function trackingPhaseRank(phase) {
  return PHASE_RANK[phase] ?? 0
}

export function normalizeTrackingSnapshot(response) {
  const payload =
    response?.payload &&
    typeof response.payload === 'object'
      ? response.payload
      : response

  const tracking =
    payload?.tracking &&
    typeof payload.tracking === 'object'
      ? payload.tracking
      : {}

  const source = {
    ...tracking,
    ...payload,
  }

  const rider =
    source.rider &&
    typeof source.rider === 'object'
      ? source.rider
      : null

  const rawEta = source.eta ?? source.delivery_eta ?? source.eta_minutes ??
    tracking.eta ?? tracking.delivery_eta ?? tracking.eta_minutes
  const eta = typeof rawEta === 'number' && Number.isFinite(rawEta)
    ? `${rawEta} min`
    : typeof rawEta === 'string' ? rawEta.trim() : ''

  return {
    ...source,
    // Preserve explicit absence rather than interpreting mapper defaults as
    // provider evidence that an order disappeared.
    active_order_absent: source.waiting === true && source.step === null &&
      Object.hasOwn(source, 'order_id') && source.order_id === null && source.done === false,
    order_id:
      source.order_id ||
      source.orderId ||
      tracking.order_id ||
      null,
    restaurant_name:
      source.restaurant_name ||
      source.restaurant ||
      '',
    order_status:
      source.order_status ||
      source.status ||
      source.step ||
      '',
    eta,
    payment_qr:
      source.payment_qr ||
      source.qr ||
      source.qr_code ||
      tracking.payment_qr ||
      tracking.qr ||
      tracking.qr_code ||
      null,
    rider,
    found: source.found,
    done: Boolean(source.done),
  }
}

export function trackingSignature(snapshot) {
  if (!snapshot) return ''

  return JSON.stringify([
    snapshot.order_id,
    trackingText(snapshot),
    snapshot.eta,
    snapshot.done,
    snapshot.found,
    snapshot.rider?.name,
  ])
}

export function screenForTracking(snapshot) {
  const phase = trackingPhase(snapshot)

  if (phase === 'cancelled') return 'cancelled'
  if (phase === 'delivered') return 'delivered'
  if (phase === 'on-the-way') return 'on-the-way'
  if (phase === 'preparing') return 'preparing'

  return 'pay'
}
