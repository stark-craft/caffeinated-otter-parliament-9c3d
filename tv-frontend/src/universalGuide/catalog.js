import { GROCERY_PRODUCTS } from '../quickbite/groceryCatalog.js'

// Replace these image paths with final demo photographs; shopping IDs stay stable.
export const HERO_SLIDES = [
  { id: 'himym', title: 'How I Met Your Mother', eyebrow: 'All seasons',
    description: 'Your favourites, together in one place.', label: 'Now streaming',
    image: './universal-guide/images/hero-entertainment.jpg',
    fallback: 'https://image.tmdb.org/t/p/original/xZFbIlSl93YbdOLuKBfaSAihck4.jpg',
    placeholder: './universal-guide/entertainment.svg', theme: 'entertainment' },
  { id: 'milk', title: 'Amul Milk · 1 L', eyebrow: 'Quick Shop · Grocery',
    description: 'Choose your quantity and make it an everyday essential.', label: 'Shop Amul milk',
    image: './universal-guide/images/hero-milk.jpg', fallback: './universal-guide/milk.svg', theme: 'milk' },
  { id: 'cola', title: 'Coca-Cola', eyebrow: 'Quick Shop · Grocery',
    description: 'Choose your quantity and settle in for the evening.', label: 'Shop Coca-Cola',
    image: './universal-guide/images/hero-cola.jpg', fallback: './universal-guide/cola.svg', theme: 'cola' },
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
