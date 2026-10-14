import { GROCERY_PRODUCTS } from '../quickbite/groceryCatalog.js'

// Replace these image paths with final demo photographs; shopping IDs stay stable.
export const HERO_SLIDES = [
  { id: 'himym', title: 'How I Met Your Mother', eyebrow: 'All seasons',
    description: 'Your favourites, together in one place.', label: 'Now streaming',
    image: './universal-guide/images/hero-entertainment.jpg',
    fallback: 'https://image.tmdb.org/t/p/original/xZFbIlSl93YbdOLuKBfaSAihck4.jpg',
    placeholder: './universal-guide/entertainment.svg', theme: 'entertainment' },
  { id: 'match-night', title: 'Match-night cravings', eyebrow: 'Quick Shop · Food',
    description: 'Good food for the big game, from a connected restaurant.',
    label: 'Find match-night food',
    image: './universal-guide/images/hero-match-night.jpg',
    fallback: './universal-guide/chips.svg', theme: 'food' },
  { id: 'grocery-basket', title: 'Match-night essentials', eyebrow: 'Quick Shop · Grocery',
    description: 'Snacks and drinks for the whole evening, all from Zepto.',
    label: 'Browse grocery essentials',
    image: './universal-guide/images/hero-grocery-basket.jpg',
    fallback: './universal-guide/milk.svg', theme: 'grocery' },
]

export function groceryLandingRequest(productId) {
  if (!['milk', 'chips'].includes(productId)) return null
  for (const [categoryId, products] of Object.entries(GROCERY_PRODUCTS)) {
    const index = products.findIndex(product => product.id === productId)
    if (index >= 0) return { type: 'voice-nav', target: {
      type: 'grocery-product', id: productId, categoryId, index, name: products[index].name,
    } }
  }
  return null
}

export const GUIDE_TABS = ['For You', 'Live', 'Apps']
export const APP_TILES = ['Netflix', 'Prime Video', 'YouTube', 'JioHotstar', 'Samsung TV Plus']
