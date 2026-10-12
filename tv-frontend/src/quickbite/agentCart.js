import { cartFromEnvelope, numericMoney, safeImageUrl } from './envelopes.js'
import { providerId, PROVIDERS } from './providers.js'

export function normalizeAgentCart(envelope) {
  const stocked = envelope?.widget === 'basket_stocked'
  const payload = envelope?.payload || envelope || {}
  const cart = stocked ? payload : cartFromEnvelope(envelope)
  if (!cart) return null
  const grocery = stocked || (cart.kind || payload.data?.kind) === 'grocery' ||
    providerId(envelope?.vendor_widget?.server) === 'swiggy_instamart' ||
    ['zepto', 'swiggy_instamart'].includes(providerId(cart.platform || envelope?.vendor_widget?.server))
  const id = providerId(cart.platform || envelope?.vendor_widget?.server, grocery ? 'grocery' : 'food')
  const platform = grocery && id ? PROVIDERS[id].label : cart.platform || cart.restaurant || ''
  const rawLines = stocked ? payload.lines : cart.items
  const items = Array.isArray(rawLines) ? rawLines : []
  const lines = items.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const quantity = Number(item.quantity ?? item.qty ?? item.count ?? 1)
    const available = item.in_stock !== false && !/unavailable|out[ _-]?of[ _-]?stock|sold[ _-]?out|not available|cut/i.test(item.status || '')
    if (grocery && (!available || !Number.isFinite(quantity) || quantity <= 0)) return []
    const name = item.name || item.item_name || item.query
    if (!name) return []
    const lineTotal = numericMoney(item.line_total ?? item.total)
    const price = numericMoney(item.unit_price) ?? (lineTotal !== null && quantity > 0 ? lineTotal / quantity : numericMoney(item.price))
    return [{ id: item.id || item.product_id || `line-${index}`, name, quantity,
      originalQuantity: quantity, price, pack_size: item.pack_size || item.requested || item.quantity_description || '',
      image_url: safeImageUrl(item.image_url, item.image, item.thumbnail), in_stock: available }]
  })
  if (!lines.length && !grocery) return null
  return { platform, lines, editable: grocery, source: stocked ? 'basket_stocked' : cart.source || 'platform',
    total: numericMoney(cart.total), totalLabel: cart.total_is_subtotal ? 'Item subtotal' : 'Total',
    dirty: false, removedLines: [], caption: envelope?.text || '',
    unavailable: (stocked ? payload.cut?.length || 0 : 0) + items.length - lines.length }
}

// Draft edits never mutate a backend cart or initiate checkout. The current
// contract does not explicitly define quantity zero as removal: keep minimum 1.
// Reaching zero removes a draft row. Keep a tombstone so Review Cart sends
// an explicit provider removal instead of silently forgetting a real item.
export function editAgentCartQuantity(model, index, delta) {
  if (!model?.editable || !model.lines?.[index]) return model
  const line = model.lines[index]
  const quantity = Math.max(0, line.quantity + delta)
  if (quantity === line.quantity) return model
  if (quantity === 0) {
    const lines = model.lines.filter((_, i) => i !== index)
    const removedLines = [...(model.removedLines || []), line]
    return { ...model, lines, removedLines, dirty: true }
  }
  const lines = model.lines.map((entry, i) => i === index ? { ...entry, quantity } : entry)
  const dirty = (model.removedLines?.length || 0) > 0 ||
    lines.some(entry => entry.quantity !== entry.originalQuantity)
  return { ...model, lines, dirty }
}

export function agentCartDisplayTotal(model) {
  if (!model?.dirty) return model?.total ?? null
  return model.lines.every(line => typeof line.price === 'number')
    ? model.lines.reduce((sum, line) => sum + line.price * line.quantity, 0) : null
}

export function agentCartEditPrompt(model) {
  if (!model?.editable || !model.platform) return ''
  const edits = model.lines.filter(line => line.quantity !== line.originalQuantity)
  const removals = model.removedLines || []
  if (!edits.length && !removals.length) return ''
  return `Update quantities in my existing ${model.platform} cart: ` +
    [...removals.map(line => `Remove ${JSON.stringify(line.name + (line.pack_size ? ` (${line.pack_size})` : ''))} completely from the existing cart.`),
      ...edits.map(line => `Set ${JSON.stringify(line.name + (line.pack_size ? ` (${line.pack_size})` : ''))} to exactly ${line.quantity}.`)].join(' ') +
    ' Do not add duplicate items, change other items, place an order, or pay. Show the updated cart total and ask me to confirm before checkout.'
}
