import { platformEntries } from './envelopes.js'

export const MERCHANT_IDS = ['zomato', 'swiggy', 'zepto']

const VERTICAL_MERCHANTS = {
  food: ['zomato', 'swiggy'],
  grocery: ['zepto', 'swiggy'],
}

function sessionConnection(platforms, merchantId) {
  const matches = platformEntries(platforms).filter((entry) =>
    String(entry.name || entry.id || entry.group || entry.platform || '')
      .toLowerCase()
      .includes(merchantId),
  )
  if (!matches.length) return false
  return matches.some((entry) =>
    (entry.connected ?? entry.authenticated ?? entry.authorized ?? entry.is_connected) === true,
  )
}

export function merchantConnected(statuses, platforms, merchantId) {
  const status = statuses?.[merchantId]
  return typeof status === 'boolean'
    ? status
    : sessionConnection(platforms, merchantId)
}

export function verticalUnlocked(statuses, platforms, vertical) {
  return (VERTICAL_MERCHANTS[vertical] || []).some((merchantId) =>
    merchantConnected(statuses, platforms, merchantId),
  )
}

export function anyMerchantConnected(statuses, platforms) {
  return MERCHANT_IDS.some((merchantId) =>
    merchantConnected(statuses, platforms, merchantId),
  )
}
