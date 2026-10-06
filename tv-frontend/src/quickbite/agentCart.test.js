import test from 'node:test'
import assert from 'node:assert/strict'
import { screenForEnvelope, defaultFocusFor, focusKeysFor, isCartDestructiveAction } from './widgetScreens.js'
import { agentCartEditPrompt, agentCartDisplayTotal, editAgentCartQuantity } from './agentCart.js'
import { buildView, viewForRequest } from './viewContext.js'
import { deriveIntent } from './deriveIntent.js'

const stocked = { widget: 'basket_stocked', payload: { platform: 'Zepto', total: 100,
  lines: [{ name: 'Cabbage', count: 2, line_total: 40, requested: '1 kg', thumbnail: 'https://images.example.test/cabbage.png', status: 'stocked' },
    { query: 'Rice', count: 2, price: 30, status: 'stocked' },
    { name: 'Unavailable', count: 2, status: 'unavailable' }, { name: 'Zero', count: 0 }],
  cut: [{ query: 'Eggs', status: 'unavailable' }] } }

test('stocked baskets normalize into editable cart rows and exclude unavailable/zero lines', () => {
  const { screen, model } = screenForEnvelope(stocked)
  assert.equal(screen, 'agent-cart')
  assert.equal(model.editable, true)
  assert.equal(model.source, 'basket_stocked')
  assert.equal(model.lines.length, 2)
  assert.equal(model.unavailable, 3)
  assert.equal(model.lines[0].price, 20)
  assert.equal(model.lines[0].pack_size, '1 kg')
  assert.equal(model.lines[0].image_url, 'https://images.example.test/cabbage.png')
  assert.equal(defaultFocusFor(screen, model), 'acart-plus-0')
  assert.deepEqual(focusKeysFor(screen, model), ['acart-minus-0','acart-plus-0','acart-minus-1','acart-plus-1','acart-checkout'])
})

test('bare Swiggy is Instamart only when grocery metadata or the actual server establishes it', () => {
  for (const env of [
    { ...stocked, payload: { ...stocked.payload, platform: 'Swiggy' } },
    { widget: 'cart', payload: { kind: 'grocery', platform: 'Swiggy', items: [{ name: 'Milk', count: 2, image: 'https://images.example.test/milk.png' }] } },
    { widget: 'cart', vendor_widget: { server: 'swiggy_instamart' }, payload: { platform: 'Swiggy', items: [{ name: 'Milk', qty: 2 }] } },
  ]) {
    const model = screenForEnvelope(env).model
    assert.equal(model.platform, 'Swiggy Instamart')
    assert.equal(model.editable, true)
    assert.equal(model.lines[0].quantity, 2)
  }
  const food = screenForEnvelope({ widget: 'cart', payload: { platform: 'Swiggy', items: [{ name: 'Samosa', qty: 1 }] } }).model
  assert.equal(food.platform, 'Swiggy')
  assert.equal(food.editable, false)
})

test('draft quantity changes target one row, preserve input and never fall below one', () => {
  const model = screenForEnvelope(stocked).model
  const edited = editAgentCartQuantity(model, 1, 1)
  assert.deepEqual(model.lines.map(line => line.quantity), [2,2])
  assert.deepEqual(edited.lines.map(line => line.quantity), [2,3])
  assert.equal(edited.dirty, true)
  assert.equal(agentCartDisplayTotal(edited), 130)
  const reverted = editAgentCartQuantity(edited, 1, -1)
  assert.equal(reverted.dirty, false)
  assert.equal(agentCartDisplayTotal(reverted), 100)
  const minimum = editAgentCartQuantity(editAgentCartQuantity(model, 0, -1), 0, -1)
  assert.equal(minimum.lines[0].quantity, 1)
  assert.equal(editAgentCartQuantity(model, 99, 1), model)
})

test('quantity review changes only edited rows and prohibits duplicate additions, checkout and payment', () => {
  const model = screenForEnvelope(stocked).model
  assert.equal(agentCartEditPrompt(model), '')
  const prompt = agentCartEditPrompt(editAgentCartQuantity(model, 1, 1))
  assert.match(prompt, /existing Zepto cart/)
  assert.match(prompt, /Set "Rice" to exactly 3/)
  assert.doesNotMatch(prompt, /Cabbage/)
  assert.match(prompt, /Do not add duplicate items, change other items, place an order, or pay/)
})

test('grocery images allow safe equivalent fields and reject unsafe candidates', () => {
  const model = screenForEnvelope({ widget: 'cart', payload: { platform: 'Zepto', items: [
    { name: 'Milk', qty: 1, image_url: 'javascript:bad()', image: 'https://images.example.test/milk.png' },
    { name: 'Eggs', qty: 1, thumbnail: 'data:image/svg+xml,bad' },
  ] } }).model
  assert.equal(model.lines[0].image_url, 'https://images.example.test/milk.png')
  assert.equal(model.lines[1].image_url, '')
})

test('empty stocked/cart responses have an intentional empty-cart state without a dead checkout key', () => {
  const { screen, model } = screenForEnvelope({ widget: 'basket_stocked', payload: { platform: 'Zepto', lines: [], cut: [{ query: 'Missing' }] } })
  assert.equal(screen, 'agent-cart')
  assert.deepEqual(model.lines, [])
  assert.deepEqual(focusKeysFor(screen, model), ['shop-more'])
})

test('editable widget snapshots retain provider and references but omit pricing and independent-search history', () => {
  const widgetModel = screenForEnvelope(stocked).model
  const view = buildView({ screen: 'agent-cart', vertical: 'grocery', widgetModel })
  assert.equal(view.cartCount, 2)
  assert.equal(view.items[0].platform, 'Zepto')
  assert.equal(view.items[0].price, null)
  const fresh = viewForRequest(view, deriveIntent('Order sushi from Zomato', view))
  assert.equal(fresh.vertical, 'food')
  assert.deepEqual(fresh.items, [])
  assert.equal(fresh.cartCount, 0)
})

test('only exact cart cancel/clear labels receive destructive confirmation; order cancellation is distinct', () => {
  for (const label of ['No, cancel','No, cancel it','clear cart','Clear my cart']) assert.equal(isCartDestructiveAction(label), true)
  for (const label of ['Cancel my order','No, thanks','Show cancelled orders','Yes, place the order']) assert.equal(isCartDestructiveAction(label), false)
})

test('grocery comparison labels normalize without relabelling Swiggy Food as Instamart', () => {
  const cards = [{ name: 'Meal', platform: 'Swiggy', price: 50 }, { name: 'Meal', platform: 'Zomato', price: 55 }]
  const food = screenForEnvelope({ widget: 'comparison', payload: { kind: 'food', cards } }).model
  assert.equal(food.vertical, 'food')
  assert.deepEqual(food.entries.map(entry => entry.platform), ['Swiggy', 'Zomato'])
  const grocery = screenForEnvelope({ widget: 'comparison', payload: { kind: 'grocery', cards: [cards[0], { name: 'Milk', platform: 'Zepto', price: 60 }] } }).model
  assert.equal(grocery.vertical, 'grocery')
  assert.deepEqual(grocery.entries.map(entry => entry.platform), ['Swiggy Instamart', 'Zepto'])
})
