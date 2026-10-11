import { GROCERY_PRODUCTS } from '../quickbite/groceryCatalog.js'

// Replace these image paths with final demo photographs; shopping IDs stay stable.
export const HERO_SLIDES = [
  { id: 'himym', title: 'How I Met Your Mother', eyebrow: 'All seasons',
    description: 'Your favourites, together in one place.', label: 'Now streaming',
    image: 'https://image.tmdb.org/t/p/original/xZFbIlSl93YbdOLuKBfaSAihck4.jpg',
    fallback: './universal-guide/entertainment.svg', theme: 'entertainment' },
  { id: 'milk', title: 'Fresh milk. Every day.', eyebrow: 'Quick Shop · Grocery',
    description: 'A little everyday essential, just a few clicks away.', label: 'Explore milk',
    image: './universal-guide/milk.svg', theme: 'milk' },
  { id: 'chips', title: 'Make it a Lay’s night.', eyebrow: 'Quick Shop · Grocery',
    description: 'Settle in with something crunchy.', label: 'Explore chips',
    image: './universal-guide/chips.svg', theme: 'chips' },
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
