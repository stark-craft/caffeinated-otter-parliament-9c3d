// Live demo transcripts: same /api/chat pipeline as STT, without the mic.
// Provider labels are explicit so no other provider may substitute silently.
export const QUICK_PROMPTS = Object.freeze([
  {
    id: 'kimchi-zepto', vertical: 'grocery', category: 'Zepto',
    title: '1 kg kimchi', description: 'Ingredients from Zepto',
    prompt: 'I want to make 1 kg kimchi. Find the ingredients and quantities from Zepto and add them to my Zepto grocery cart.',
  },
  {
    id: 'chicken-biryani-zepto', vertical: 'grocery', category: 'Zepto',
    title: '1 kg chicken biryani', description: 'Ingredients from Zepto',
    prompt: 'I want to make 1 kg chicken biryani. Find the ingredients and quantities from Zepto and add them to my Zepto grocery cart.',
  },
  {
    id: 'veg-biryani-instamart', vertical: 'grocery', category: 'Instamart',
    title: '1 kg veg biryani', description: 'Ingredients from Instamart',
    prompt: 'I want to make 1 kg vegetable biryani. Find the ingredients and quantities from Swiggy Instamart and add them to my Swiggy Instamart grocery cart.',
  },
  {
    id: 'poha-instamart', vertical: 'grocery', category: 'Instamart',
    title: 'Poha ingredients', description: 'Breakfast basket from Instamart',
    prompt: 'I want to make poha for two people. Find the ingredients and quantities from Swiggy Instamart and add them to my Swiggy Instamart grocery cart.',
  },
  {
    id: 'ten-samosa-mithaas-zomato', vertical: 'food', category: 'Zomato',
    title: '10 samosas · Mithaas', description: 'Test quantity and restaurant',
    prompt: 'Order 10 samosa from Mithaas from ZOMATO',
  },
  {
    id: 'eight-samosa-hadiram-zomato', vertical: 'food', category: 'Zomato',
    title: '8 samosas · Hadiram', description: 'Test quantity and restaurant',
    prompt: 'Order 8 samosa from ZOMATO from hadiram',
  },
  {
    id: 'pizza-zomato', vertical: 'food', category: 'Zomato',
    title: 'Pizza near me', description: 'Find pizza restaurants',
    prompt: 'Find pizza restaurants on Zomato near me and show available choices.',
  },
  {
    id: 'pav-bhaji-zomato', vertical: 'food', category: 'Zomato',
    title: 'Pav bhaji', description: 'Find pav bhaji restaurants',
    prompt: 'Find pav bhaji restaurants on Zomato near me and show available choices.',
  },
  {
    id: 'biryani-swiggy', vertical: 'food', category: 'Swiggy Food',
    title: 'Chicken biryani', description: 'Find biryani restaurants',
    prompt: 'Find chicken biryani restaurants on Swiggy Food near me and show available choices.',
  },
  {
    id: 'dosa-swiggy', vertical: 'food', category: 'Swiggy Food',
    title: 'Masala dosa', description: 'Find dosa restaurants',
    prompt: 'Find masala dosa restaurants on Swiggy Food near me and show available choices.',
  },
])

export function quickPromptAt(index) {
  return Number.isInteger(index) && index >= 0 && index < QUICK_PROMPTS.length
    ? QUICK_PROMPTS[index] : null
}

export function modeFocusAfterArrow(focus, key) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return null
  if (focus === 'screen-heading') {
    if (key === 'ArrowDown') return 'mode-food'
    return focus
  }
  if (focus === 'mode-food' || focus === 'mode-grocery') {
    if (key === 'ArrowLeft' || key === 'ArrowRight')
      return focus === 'mode-food' ? 'mode-grocery' : 'mode-food'
    if (key === 'ArrowDown') return 'quick-prompt-0'
    if (key === 'ArrowUp') return 'screen-heading'
  }
  const match = String(focus).match(/^quick-prompt-(\d+)$/)
  if (match) {
    const index = Number(match[1])
    if (!quickPromptAt(index)) return null
    if (key === 'ArrowUp') return index ? `quick-prompt-${index - 1}` : 'mode-food'
    if (key === 'ArrowDown') return quickPromptAt(index + 1) ? `quick-prompt-${index + 1}` : 'back'
    return focus
  }
  if (focus === 'back' && key === 'ArrowUp') return `quick-prompt-${QUICK_PROMPTS.length - 1}`
  return null
}
