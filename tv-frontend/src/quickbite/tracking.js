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

  if (text.includes('cancel')) return 'cancelled'

  if (
    text.includes('deliver') ||
    (snapshot.done === true && !text.includes('cancel'))
  ) {
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

  return {
    ...source,
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
    payment_qr:
      source.payment_qr ||
      source.qr ||
      source.qr_code ||
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
