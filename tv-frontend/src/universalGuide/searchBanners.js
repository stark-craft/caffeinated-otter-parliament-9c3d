import { HERO_SLIDES } from './catalog.js'

// Only an actual commerce slide triggers discovery. Entertainment remains inert.
// Returns a plan; App performs authentication and sends exactly one search.
const MATCH_NIGHT = new Set(['match-night', 'matchnight'])
const GROCERY_BASKET = new Set(['grocery-basket', 'grocery-essentials'])

function connected(status, merchant) {
  try { return Boolean(status?.(merchant)) } catch { return false }
}

export function searchBannerPlan(slideId, isMerchantConnected = () => false) {
  const id = String(slideId || '').trim().toLowerCase()
  if (!HERO_SLIDES.some(slide => slide.id === id)) return null

  if (MATCH_NIGHT.has(id)) {
    const zomato = connected(isMerchantConnected, 'zomato')
    const swiggy = connected(isMerchantConnected, 'swiggy')
    // Prefer Zomato, use Swiggy only when Zomato is disconnected.
    // Without either connection, request Food login before searching.
    const provider = zomato ? 'zomato' : swiggy ? 'swiggy_food' : null
    const platform = zomato ? 'Zomato' : 'Swiggy Food'
    return {
      id,
      label: 'Match-night food',
      vertical: 'food',
      provider,
      login: !provider,
      prompt: `Find shareable match-night food and snacks at restaurants near me on ${platform} only. Show fresh live restaurant or dish choices from that one connected provider. This is search only. Do not add items to any cart, pay, or place an order.`,
    }
  }

  if (GROCERY_BASKET.has(id)) {
    return {
      id,
      label: 'Match-night grocery essentials',
      vertical: 'grocery',
      provider: 'zepto',
      login: !connected(isMerchantConnected, 'zepto'),
      prompt: 'Find these five match-night grocery essentials near me on Zepto only: potato chips, popcorn, Coca-Cola, salted peanuts, and biscuits. Return fresh structured grocery offers and real prices from Zepto. This is one multi-product search request, not a comparison and not a cart mutation. Do not add, edit, remove, checkout, or place an order.',
    }
  }

  return null
}
