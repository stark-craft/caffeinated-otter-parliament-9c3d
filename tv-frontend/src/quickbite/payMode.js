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

/** The order's platform, from whichever part of the journey knows it. */
export function orderPlatform({
  cart,
  groceryCard,
  restaurant,
} = {}) {
  return (
    cart?.platform ||
    groceryCard?.platform ||
    restaurant?.platform ||
    cart?.store ||
    ''
  )
}
