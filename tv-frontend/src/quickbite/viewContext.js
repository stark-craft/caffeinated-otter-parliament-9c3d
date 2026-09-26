/* The bounded snapshot sent with every utterance.
 *
 * Three properties the first version lacked:
 *  - screen-specific: on `cart` it describes cart lines, not a stale
 *    restaurant list that happens to still be in state
 *  - stable ids: derived from platform + name, so "the second one" cannot
 *    land on a different row after a refresh reorders results
 *  - a revision derived from the content itself, so a stale reference is
 *    detectable without the panel maintaining a counter
 *
 * It carries no address, phone, payment detail or cart pricing - only what is
 * needed to resolve a reference and to bias transcription. */

const MAX_ITEMS = 12

const WIDGET_FOR_SCREEN = {
  restaurant: 'carousel',
  gresults: 'carousel',
  dish: 'carousel',
  gproduct: 'carousel',
  category: 'grid',
  gcategory: 'grid',
  mode: 'grid',
  menu: 'menu',
  review: 'menu',
  greview: 'menu',
  cart: 'cart',
  pay: 'cart',
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
}

function stableId(entry, index) {
  const platform = slug(entry.platform)
  const name = slug(entry.name)

  if (!name) return `i${index}`

  return platform
    ? `${platform}:${name}`
    : name
}

function trailingIndex(focusKey) {
  const n = Number(
    String(focusKey || '')
      .split('-')
      .pop(),
  )

  return Number.isFinite(n)
    ? n
    : 0
}

/* A 32-bit FNV-1a over the id list. Any change to what is on screen - order,
   membership, the screen itself - produces a different revision. */

function revisionOf(screen, ids) {
  let hash = 0x811c9dc5

  for (const chunk of [screen, ...ids]) {
    for (
      let i = 0;
      i < chunk.length;
      i += 1
    ) {
      hash ^= chunk.charCodeAt(i)
      hash =
        Math.imul(
          hash,
          0x01000193,
        ) >>> 0
    }
  }

  return hash
}

function sourceFor(state) {
  switch (state?.screen) {
    case 'cart':
    case 'pay':
      return state?.cart?.items || []

    case 'gresults':
      return state?.groceryResults || []

    case 'gproduct':
      return state?.products || []

    case 'restaurant':
      return state?.restaurants || []

    case 'dish':
      return state?.dishes || []

    case 'category':
      return state?.categories || []

    case 'gcategory':
      return state?.groceryCategories || []

    case 'menu':
    case 'review':
      return state?.menuItems || []

    case 'greview':
      return state?.selectedGroceryCard
        ? [state.selectedGroceryCard]
        : []

    default:
      return []
  }
}

export function buildView(state) {
  const screen =
    state?.screen || 'home'

  const raw =
    (sourceFor(state) || [])
      .slice(0, MAX_ITEMS)

  /* Price is what makes "the cheaper one" work on a results screen. On `cart`
     and `pay` the items ARE the user's cart lines, so the same field stops
     being a catalogue fact and becomes what they are about to be charged —
     which this snapshot is not allowed to carry off the device. */

  const carriesPrice =
    screen !== 'cart' &&
    screen !== 'pay'

  const items = raw.map(
    (entry, index) => ({
      id: stableId(
        entry,
        index,
      ),
      name:
        entry.name || '',
      platform:
        entry.platform || '',
      price: carriesPrice
        ? entry.price ??
          entry.offer_price ??
          null
        : null,
      rating:
        entry.rating ?? null,
    }),
  )

  return {
    screen,
    vertical:
      state?.vertical || 'food',
    widget:
      WIDGET_FOR_SCREEN[screen] ||
      'message',
    focus_index:
      Math.min(
        trailingIndex(
          state?.focusKey,
        ),
        Math.max(
          0,
          items.length - 1,
        ),
      ),
    cartCount:
      (state?.cart?.items || [])
        .length,
    hasActiveOrder:
      Boolean(
        state?.activeOrder?.seq,
      ),
    view_revision:
      revisionOf(
        screen,
        items.map((i) => i.id),
      ),
    items,
  }
}

export function keyTermsFrom(view) {
  const terms = []

  for (
    const item of
    view?.items || []
  ) {
    if (item.name) {
      terms.push(item.name)
    }

    if (item.platform) {
      terms.push(item.platform)
    }
  }

  return [
    ...new Set(terms),
  ].slice(0, 50)
}
