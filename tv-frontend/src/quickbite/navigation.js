/* Back-navigation for the panel's screen machine.
   Food and grocery are parallel paths of the same length that rejoin at `cart`.
   Every screen has one fixed parent except `cart`, whose parent depends on which
   path you walked in on — hence `backScreenFor` rather than a bare map lookup. */

export const BACK_SCREEN = {
  mode: 'home',
  category: 'mode',
  dish: 'category',
  restaurant: 'dish',

  // A fetched restaurant menu. `review` shows a single item, so a menu needs
  // its own screen; naming a restaurant by voice lands here.
  menu: 'restaurant',
  review: 'restaurant',

  gcategory: 'mode',
  gproduct: 'gcategory',
  gresults: 'gproduct',
  greview: 'gresults',

  // Back from a stocked basket returns to the grocery entry point: the
  // basket came from a spoken list, not from drilling into a product.
  gbasket: 'gcategory',

  // Agent-driven widget screens can appear from anywhere, so Back goes home
  // unless the router recorded where the user jumped from (backTarget).
  text: 'home',
  'agent-cart': 'home',
  compare: 'home',
  'basket-compare': 'home',
  spend: 'home',

  cart: 'review',
  pay: 'cart',
  'payment-received': 'pay',
  preparing: 'payment-received',
  'on-the-way': 'preparing',
  delivered: 'on-the-way',
  cancelled: 'pay',
  'cart-cleared': 'mode',
}

export function backScreenFor(screen, vertical) {
  if (screen === 'cart') {
    return vertical === 'grocery'
      ? 'greview'
      : 'review'
  }

  return BACK_SCREEN[screen] || 'home'
}

/* A voice intent can land the user on a screen the linear map has the wrong
   parent for: jump from `gproduct` straight to `cart` and `backScreenFor`
   answers `greview`, which the user never saw. The router records where the
   jump came from; Back honours it once, for that screen only. */

export function backTarget(
  screen,
  vertical,
  jumpOrigin,
) {
  if (
    jumpOrigin &&
    jumpOrigin.to === screen
  ) {
    return jumpOrigin.from
  }

  return backScreenFor(
    screen,
    vertical,
  )
}

/* Keep the screen the viewer actually left. The fixed map above remains a
   fallback for a screen opened without a recorded predecessor. */
export function recordScreenVisit(history, current, next, { replace = false } = {}) {
  if (replace || !current || current === next) return history
  return [...history, current]
}

export function takePreviousScreen(history) {
  if (!history.length) return { screen: null, history }
  return { screen: history[history.length - 1], history: history.slice(0, -1) }
}

export function qrFocusAfterArrow(current, key, canRetry) {
  if (!canRetry) return 'close'
  if (key === 'ArrowUp' || key === 'ArrowLeft') return 'retry'
  if (key === 'ArrowDown' || key === 'ArrowRight') return 'close'
  return current
}

export function editableCartFocusAfterArrow(current, key, count) {
  const match = String(current).match(/^acart-(minus|plus)-(\d+)$/)
  if (current === 'acart-checkout' && key === 'ArrowUp' && count) return `acart-plus-${count - 1}`
  if (!match) return null
  const [, side, row] = match
  const index = Number(row)
  if (key === 'ArrowLeft') return `acart-minus-${index}`
  if (key === 'ArrowRight') return `acart-plus-${index}`
  if (key === 'ArrowUp') return index ? `acart-${side}-${index - 1}` : current
  if (key === 'ArrowDown') return index + 1 < count ? `acart-${side}-${index + 1}` : 'acart-checkout'
  return null
}
