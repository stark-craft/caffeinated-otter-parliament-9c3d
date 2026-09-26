export const GROCERY_CATEGORIES = [
  {
    id: 'fruits-veg',
    name: 'Fruits & Vegetables',
    emoji: '🥬',
    accent: '#4caf72',
    image: '/images/grocery/categories/fruits-veg.jpg',
    prompt: 'Compare fresh fruits and vegetables across Swiggy Instamart and Zepto. Show me the cheapest options I can order.',
  },
  {
    id: 'dairy-bakery',
    name: 'Dairy & Bakery',
    emoji: '🥛',
    accent: '#5a9fd4',
    image: '/images/grocery/categories/dairy-bakery.jpg',
    prompt: 'Compare dairy and bakery products across Swiggy Instamart and Zepto. Show me the cheapest options I can order.',
  },
  {
    id: 'snacks-packaged',
    name: 'Snacks & Packaged',
    emoji: '🍪',
    accent: '#e0a33e',
    image: '/images/grocery/categories/snacks-packaged.jpg',
    prompt: 'Compare packaged snacks across Swiggy Instamart and Zepto. Show me the cheapest options I can order.',
  },
  {
    id: 'beverages-grocery',
    name: 'Beverages',
    emoji: '🧃',
    accent: '#d15f6a',
    image: '/images/grocery/categories/beverages-grocery.jpg',
    prompt: 'Compare packaged beverages across Swiggy Instamart and Zepto. Show me the cheapest options I can order.',
  },
]

export const GROCERY_PRODUCTS = {
  'fruits-veg': [
    {
      id: 'bananas',
      name: 'Bananas',
      emoji: '🍌',
      image: '/images/grocery/products/bananas.jpg',
    },
    {
      id: 'tomatoes',
      name: 'Tomatoes',
      emoji: '🍅',
      image: '/images/grocery/products/tomatoes.jpg',
    },
    {
      id: 'onions',
      name: 'Onions',
      emoji: '🧅',
      image: '/images/grocery/products/onions.jpg',
    },
    {
      id: 'potatoes',
      name: 'Potatoes',
      emoji: '🥔',
      image: '/images/grocery/products/potatoes.jpg',
    },
  ],

  'dairy-bakery': [
    {
      id: 'milk',
      name: 'Milk',
      emoji: '🥛',
      image: '/images/grocery/products/milk.jpg',
    },
    {
      id: 'bread',
      name: 'Bread',
      emoji: '🍞',
      image: '/images/grocery/products/bread.jpg',
    },
    {
      id: 'eggs',
      name: 'Eggs',
      emoji: '🥚',
      image: '/images/grocery/products/eggs.jpg',
    },
    {
      id: 'paneer',
      name: 'Paneer',
      emoji: '🧀',
      image: '/images/grocery/products/paneer.jpg',
    },
  ],

  'snacks-packaged': [
    {
      id: 'chips',
      name: 'Chips',
      emoji: '🥔',
      image: '/images/grocery/products/chips.jpg',
    },
    {
      id: 'biscuits',
      name: 'Biscuits',
      emoji: '🍪',
      image: '/images/grocery/products/biscuits.jpg',
    },
    {
      id: 'namkeen',
      name: 'Namkeen',
      emoji: '🥨',
      image: '/images/grocery/products/namkeen.jpg',
    },
  ],

  'beverages-grocery': [
    {
      id: 'cola',
      name: 'Cola',
      emoji: '🥤',
      image: '/images/grocery/products/cola.jpg',
    },
    {
      id: 'orange-juice',
      name: 'Orange Juice',
      emoji: '🧃',
      image: '/images/grocery/products/orange-juice.jpg',
    },
    {
      id: 'green-tea',
      name: 'Green Tea',
      emoji: '🍵',
      image: '/images/grocery/products/green-tea.jpg',
    },
  ],
}

/* Naming both platforms is what routes the agent to compare_grocery rather than
   a single-platform search — see the CROSS-PLATFORM GROCERY COMPARE rules in
   core/agent.py:140. */

export function productSearchPrompt(product) {
  return (
    `Compare ${product.name} across Swiggy Instamart and Zepto. ` +
    `Show me the cheapest options I can order.`
  )
}
