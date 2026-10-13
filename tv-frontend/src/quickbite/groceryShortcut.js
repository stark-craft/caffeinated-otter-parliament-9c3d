import { providerId } from './providers.js'

// Banner products: milk still requires an exact 1 L pack; Coca-Cola picks the\n// first available regular Coke offer regardless of pack size, retaining its real pack.
export const GROCERY_SHORTCUTS = {
  milk: { id: 'milk', name: 'Amul Milk 1 L' },
  cola: { id: 'cola', name: 'Coca-Cola' },
}

export function groceryShortcutRequest(productId) {
  return ['milk', 'cola'].includes(productId)
    ? { type: 'grocery-shortcut', productId } : null
}

export function groceryShortcutPrompt(product, requestId = 'new', recovery = false) {
  const token = String(requestId).replace(/[^a-z0-9-]/gi, '').slice(0, 30) || 'new'
  return `Find ${product.name} near me. This is independent grocery discovery ${token}${recovery ? '-recheck' : ''}. Look up currently available provider offers afresh, regardless of prior searches. Do not refer to or summarize earlier search results. Return structured grocery carousel cards with name, brand, pack_size, price, platform and in_stock for quantity review. Do not answer "Same fresh results — no changes". This request is search only.`
}
export function isRepeatedResultSummary(envelope) {
  if (envelope?.widget !== 'text') return false
  const text = [envelope?.text, envelope?.payload?.title].filter(Boolean).join(' ')
  return /same fresh results|same results|no changes|unchanged results/i.test(text)
}

function words(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9.]+/g, ' ').trim()
}

function oneLitre(card) {
  const pack = String(card.pack_size || card.quantity_description || card.name || '')
    .normalize('NFKC').toLowerCase().replace(/[×*]/g, 'x')
  // A 2 x 500 ml bundle is not the requested single 1 L pack.
  const counts = [...pack.matchAll(/(?:\b(\d+)\s*x|x\s*(\d+)\b|\b(?:pack|case|set)\s*(?:of\s*)?(\d+)\b)/gu)]
  if (counts.some(match => Number(match[1] || match[2] || match[3]) !== 1)) return false
  const sizes = [...pack.matchAll(/\b(\d+(?:\.\d+)?)\s*(ml|litres?|liters?|ltrs?|l)\b/gu)]
  return sizes.length === 1 && Number(sizes[0][1]) * (sizes[0][2] === 'ml' ? 1 : 1000) === 1000
}

export function firstMatchingGroceryOffer(cards, productId) {
  if (!groceryShortcutRequest(productId) || !Array.isArray(cards)) return null
  // Preserve response order: a later cheaper/best-marked offer does not win.
  return cards.find(card => {
    if (card.in_stock !== true || !['number', 'string'].includes(typeof card.price) || !String(card.price).trim() ||
      !Number.isFinite(Number(card.price)) || Number(card.price) < 0 ||
      !['zepto', 'swiggy_instamart'].includes(providerId(card.platform, 'grocery'))) return false
    const name = words(card.name)
    const text = words(`${card.brand || ''} ${card.name || ''}`)
    if (productId === 'milk') return oneLitre(card) && /\bamul\b/u.test(text) && /\bmilk\b/u.test(name) &&
      !/\b(?:powder|shake|milkshake|flavou?red|chocolate)\b/u.test(name)
    return /\b(?:coca cola|cocacola)\b/u.test(text) && /\b(?:cola|cocacola)\b/u.test(name) &&
      !/\b(?:zero|diet|light|sugar free)\b/u.test(text)
  }) || null
}
