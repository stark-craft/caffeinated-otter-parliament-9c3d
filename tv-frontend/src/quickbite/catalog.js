export const QUICKBITE_CATEGORIES = [
  {
    id: 'snacks',
    name: 'Snacks',
    emoji: '🥟',
    accent: '#f18b44',
    image: '/images/categories/snacks.jpg',
    prompt: 'Compare the best snacks near me across Zomato and Swiggy. Show me restaurants I can order from.',
  },
  {
    id: 'desserts',
    name: 'Desserts',
    emoji: '🍮',
    accent: '#d977a8',
    image: '/images/categories/desserts.jpg',
    prompt: 'Compare the best desserts near me across Zomato and Swiggy. Show me restaurants I can order from.',
  },
  {
    id: 'beverages',
    name: 'Beverages',
    emoji: '🥤',
    accent: '#52a9c9',
    image: '/images/categories/beverages.jpg',
    prompt: 'Compare the best beverages and drinks near me across Zomato and Swiggy. Show me restaurants I can order from.',
  },
  {
    id: 'fullmeal',
    name: 'Full Meal',
    emoji: '🍱',
    accent: '#d7a746',
    image: '/images/categories/fullmeal.jpg',
    prompt: 'Compare the best full meals and thalis near me across Zomato and Swiggy. Show me restaurants I can order from.',
  },
]

export const QUICKBITE_DISHES = {
  snacks: [
    {
      id: 'samosa',
      name: 'Samosa',
      emoji: '🫔',
      image: '/images/snacks/Samose.jpg',
    },
    {
      id: 'chole-bhature',
      name: 'Chole Bhature',
      emoji: '🫓',
      image: '/images/snacks/Chole-Bhature.jpg',
    },
    {
      id: 'pao-bhaji',
      name: 'Pao Bhaji',
      emoji: '🍛',
      image: '/images/snacks/Pao-Bhaji.jpg',
    },
    {
      id: 'biryani',
      name: 'Biryani',
      emoji: '🍚',
      image: '/images/snacks/Biryani.jpg',
    },
  ],

  desserts: [
    {
      id: 'gulab-jamun',
      name: 'Gulab Jamun',
      emoji: '🍯',
      image: '/images/desserts/Gulab-Jamun.jpg',
    },
    {
      id: 'kaju-katli',
      name: 'Kaju Katli',
      emoji: '🧈',
      image: '/images/desserts/Kaju-Katli.jpg',
    },
    {
      id: 'rasgulla',
      name: 'Rasgulla',
      emoji: '🥣',
      image: '/images/desserts/Rasgulla.jpg',
    },
  ],

  beverages: [
    {
      id: 'masala-chai',
      name: 'Masala Chai',
      emoji: '☕',
      image: '/images/beverages/Masala-Chai.jpg',
    },
    {
      id: 'lassi',
      name: 'Lassi',
      emoji: '🥛',
      image: '/images/beverages/Lassi.jpg',
    },
    {
      id: 'thandai',
      name: 'Thandai',
      emoji: '🧃',
      image: '/images/beverages/Thandai.jpg',
    },
  ],

  fullmeal: [
    {
      id: 'veg-thali',
      name: 'Veg Thali',
      emoji: '🍱',
      image: '/images/fullmeal/Veg-Thali.jpg',
    },
    {
      id: 'rajma-chawal',
      name: 'Rajma Chawal',
      emoji: '🍛',
      image: '/images/fullmeal/Rajma-Chawal.jpg',
    },
    {
      id: 'dal-makhani',
      name: 'Dal Makhani',
      emoji: '🥘',
      image: '/images/fullmeal/Dal-Makhani.jpg',
    },
  ],
}

/* Naming both platforms is what routes the agent to compare_food rather than a
   single-platform search — see the CROSS-PLATFORM rules in core/agent.py. The
   returned cards carry their own `platform`, which selectRestaurant then uses
   for the menu fetch. */

export function dishSearchPrompt(dish) {
  return (
    `Compare ${dish.name} across Zomato and Swiggy. ` +
    `Show me restaurants I can order from.`
  )
}
