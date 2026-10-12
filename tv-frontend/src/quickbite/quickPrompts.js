// Fixed demo scenarios use exactly the same transcript->intent->/api/chat
// pipeline as real speech. They never call STT and never fabricate results.
export const QUICK_PROMPTS = Object.freeze([
  {
    id: 'chicken-biryani',
    vertical: 'grocery',
    category: 'Grocery',
    title: '1 kg chicken biryani',
    description: 'Build an ingredient basket',
    prompt: 'I want to make 1 kg chicken biryani. Find all the ingredients and quantities I need and add them to my grocery cart.',
  },
  {
    id: 'kimchi',
    vertical: 'grocery',
    category: 'Grocery',
    title: '1 kg kimchi',
    description: 'Build an ingredient basket',
    prompt: 'I want to make 1 kg kimchi. Find all the ingredients and quantities I need and add them to my grocery cart.',
  },
  {
    id: 'pizza-zomato',
    vertical: 'food',
    category: 'Food · Zomato',
    title: 'Pizza near me',
    description: 'Find Zomato restaurants',
    prompt: 'Find pizza restaurants on Zomato near me and show me options to choose from.',
  },
  {
    id: 'pav-bhaji-haldiram',
    vertical: 'food',
    category: 'Food · Zomato',
    title: 'Pav bhaji at Haldiram',
    description: 'Open the restaurant menu',
    prompt: "Find Haldiram on Zomato and show pav bhaji options from that restaurant's menu.",
  },
])

export function quickPromptAt(index) {
  return Number.isInteger(index) && index >= 0 && index < QUICK_PROMPTS.length
    ? QUICK_PROMPTS[index] : null
}

// Remote navigation on the mode screen: two tiles at the top, then a simple
// up/down list of four prompts. Up from Back returns to the last prompt.
export function modeFocusAfterArrow(focus, key) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return null
  if (focus === 'mode-food' || focus === 'mode-grocery') {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      return focus === 'mode-food' ? 'mode-grocery' : 'mode-food'
    }
    if (key === 'ArrowDown') return 'quick-prompt-0'
    if (key === 'ArrowUp') return focus
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
