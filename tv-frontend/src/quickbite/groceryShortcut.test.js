import test from 'node:test'
import assert from 'node:assert/strict'
import { groceryCardsFromEnvelope } from './envelopes.js'
import { GROCERY_SHORTCUTS, groceryShortcutRequest, groceryShortcutPrompt, firstMatchingGroceryOffer, isRepeatedResultSummary } from './groceryShortcut.js'

const milk = { name: 'Amul Taaza Toned Milk', brand: 'Amul', pack_size: '1 L', price: 74, platform: 'Zepto', in_stock: true }
const cola = { name: 'Coca-Cola Original Taste', pack_size: '1 L', price: 60, platform: 'Swiggy Instamart', in_stock: true }

test('banner discovery selects the first valid offer in response order, preserving its price and store', () => {
  const cards = groceryCardsFromEnvelope({ widget: 'carousel', payload: { kind: 'grocery', cards: [
    { ...milk, name: 'Other Brand Milk', brand: 'Other' },
    { ...milk, in_stock: false },
    { ...milk, platform: 'swiggy_instamart', price: 80 },
    { ...milk, price: 60, best: true },
  ] } })
  const before = JSON.stringify(cards)
  assert.equal(firstMatchingGroceryOffer(cards, 'milk'), cards[2])
  assert.equal(firstMatchingGroceryOffer(cards, 'milk').platform, 'Swiggy Instamart')
  assert.equal(firstMatchingGroceryOffer(cards, 'milk').price, 80)
  assert.equal(JSON.stringify(cards), before)
})

test('Amul milk matching requires the requested single 1 L pack, including equivalent volume units', () => {
  for (const pack_size of ['1 L', '1 litre', '1ltr', '1000 ml', '1.0 liter', '1 L (pack of 1)']) {
    assert.ok(firstMatchingGroceryOffer([{ ...milk, pack_size }], 'milk'), pack_size)
  }
  for (const pack_size of ['500 ml', '2 L', '2 x 500 ml', '1 L x 2', '1 L pack of 6', '']) {
    assert.equal(firstMatchingGroceryOffer([{ ...milk, pack_size }], 'milk'), null, pack_size)
  }
  for (const name of ['Amul Milk Powder', 'Amul Chocolate Milk', 'Amul Milkshake', 'Amulya Milk']) {
    assert.equal(firstMatchingGroceryOffer([{ ...milk, name, brand: '' }], 'milk'), null, name)
  }
  assert.ok(firstMatchingGroceryOffer([{ ...milk, pack_size: '', name: 'Amul Milk 1 L' }], 'milk'))
})

test('Coca-Cola shortcut takes the first priced, stocked regular Coca-Cola offer of any size', () => {
  for (const name of ['Coca-Cola Original Taste', 'Coca Cola Soft Drink', 'CocaCola']) {
    assert.ok(firstMatchingGroceryOffer([{ ...cola, name }], 'cola'), name)
  }
  for (const name of ['Pepsi Cola', 'Coca-Cola Zero Sugar', 'Diet Coca-Cola', 'Coca-Cola Light', 'Coca Cola Sugar Free', 'Sprite']) {
    assert.equal(firstMatchingGroceryOffer([{ ...cola, name }], 'cola'), null, name)
  }
  for (const pack_size of ['250 ml', '500 ml', '1 L', '2 L', '']) {
    assert.ok(firstMatchingGroceryOffer([{ ...cola, pack_size }], 'cola'), pack_size)
  }
  const candidates = [
    { ...cola, name: 'Pepsi Cola', price: 10 },
    { ...cola, name: 'Coca-Cola Zero Sugar', price: 20 },
    { ...cola, name: 'Coca-Cola Original Taste', pack_size: '500 ml', price: 40 },
    { ...cola, name: 'Coca-Cola Original Taste', pack_size: '1 L', price: 70 },
  ]
  assert.equal(firstMatchingGroceryOffer(candidates, 'cola'), candidates[2])
  assert.equal(GROCERY_SHORTCUTS.cola.name, 'Coca-Cola')
})

test('automatic selection rejects missing availability, price or valid grocery provider', () => {
  for (const change of [{ in_stock: undefined }, { in_stock: false }, { price: null }, { price: '' },
    { price: ' ' }, { price: false }, { price: 'unknown' }, { price: -1 }, { platform: '' }, { platform: 'Zomato' }]) {
    assert.equal(firstMatchingGroceryOffer([{ ...milk, ...change }], 'milk'), null, JSON.stringify(change))
  }
  assert.equal(firstMatchingGroceryOffer([], 'milk'), null)
  assert.equal(firstMatchingGroceryOffer(null, 'milk'), null)
  assert.equal(firstMatchingGroceryOffer([cola], 'chips'), null)
})

test('promotions issue search requests only for milk and cola; entertainment remains inert', () => {
  for (const id of ['himym', 'chips', 'checkout', '__proto__']) assert.equal(groceryShortcutRequest(id), null)
  for (const product of Object.values(GROCERY_SHORTCUTS)) {
    assert.deepEqual(groceryShortcutRequest(product.id), { type: 'grocery-shortcut', productId: product.id })
    assert.match(groceryShortcutPrompt(product), new RegExp(product.name))
    assert.match(groceryShortcutPrompt(product), /search only/u)
    // Avoid triggering the existing cart-filling prompt heuristic.
    assert.doesNotMatch(groceryShortcutPrompt(product), /\badd\b|\bcart\b|\brecipe\b|\bingredients?\b|\beverything\b/iu)
  }
})


test('Repeated summary is not stock and a fresh request has a distinct identity', () => {
  assert.equal(isRepeatedResultSummary({ widget: 'text', text: 'Same fresh results — no changes:' }), true)
  assert.equal(isRepeatedResultSummary({ widget: 'text', payload: { title: 'Same results, unchanged' } }), true)
  assert.equal(isRepeatedResultSummary({ widget: 'text', text: 'Zepto is disconnected' }), false)
  assert.equal(isRepeatedResultSummary({ widget: 'carousel', text: 'Same results' }), false)
  const first = groceryShortcutPrompt(GROCERY_SHORTCUTS.milk, 101)
  const second = groceryShortcutPrompt(GROCERY_SHORTCUTS.milk, 102)
  assert.notEqual(first, second)
  assert.match(second, /independent grocery discovery/)
  assert.match(groceryShortcutPrompt(GROCERY_SHORTCUTS.milk, 102, true), /recheck/)
  assert.doesNotMatch(first, /\badd\b|\bcart\b|\brecipe\b|\bingredients?\b|\beverything\b/iu)
})
