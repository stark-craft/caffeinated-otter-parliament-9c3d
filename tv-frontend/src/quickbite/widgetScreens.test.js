import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { screenForEnvelope, focusKeysFor } from './widgetScreens.js'

test('existing backend envelope fixtures route to their intended screens', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./fixtures/widget_envelopes.json', import.meta.url)))
  const expected = {
    cart: 'agent-cart',
    comparison: 'compare',
    basket: 'basket-compare',
    spend_report: 'spend',
  }
  for (const [name, screen] of Object.entries(expected)) {
    assert.equal(screenForEnvelope(fixtures[name]).screen, screen, name)
  }
})

test('text envelope keeps top-level backend actions', () => {
  const result = screenForEnvelope({
    widget: 'text',
    text: 'Choose what to do next.',
    actions: ['Show the menu'],
    payload: { title: 'Choose what to do next.', actions: [] },
  })
  assert.equal(result.screen, 'text')
  assert.deepEqual(result.model.actions, ['Show the menu'])
  assert.equal(result.model.retry, false)
})

test('valid text without a structured title is an answer, not a retry error', () => {
  const result = screenForEnvelope({ widget: 'text', text: 'Nothing is open nearby.', actions: ['Search again'] })
  assert.equal(result.model.title, 'Nothing is open nearby.')
  assert.deepEqual(result.model.actions, ['Search again'])
  assert.equal(result.model.retry, false)
})

test('empty and unknown envelopes fall back safely instead of becoming restaurants', () => {
  assert.deepEqual(screenForEnvelope({ widget: 'text' }).model.retry, true)
  assert.equal(screenForEnvelope({ widget: 'new_widget', text: 'Not supported yet.' }).screen, 'text')
})

test('nested carousel kind is routed consistently with the existing card mappers', () => {
  const grocery = screenForEnvelope({
    widget: 'carousel',
    payload: { data: { kind: 'grocery', cards: [{ name: 'Milk', platform: 'Zepto', price: 55 }] } },
  })
  assert.equal(grocery.screen, 'gresults')
  assert.equal(grocery.model[0].name, 'Milk')

  const food = screenForEnvelope({
    widget: 'carousel',
    payload: { data: { kind: 'food', cards: [{ name: 'Example Kitchen', platform: 'Zomato' }] } },
  })
  assert.equal(food.screen, 'restaurant')
  assert.equal(food.model[0].name, 'Example Kitchen')
})


test('stocked baskets use an editable agent cart with a separate Clear Cart action', () => {
  const { screen, model } = screenForEnvelope({
    widget: 'basket_stocked', payload: { platform: 'Zepto', total: 120,
      lines: [{ name: 'Milk', count: 2, unit_price: 60, status: 'stocked' }] },
  })
  assert.equal(screen, 'agent-cart')
  assert.equal(model.editable, true)
  assert.deepEqual(focusKeysFor(screen, model),
    ['acart-minus-0', 'acart-plus-0', 'acart-checkout', 'acart-clear'])
})

test('food carts retain preview and Edit items, while Clear Cart is explicitly focusable', () => {
  const { screen, model } = screenForEnvelope({
    widget: 'cart', payload: { platform: 'Swiggy', total: 120,
      items: Array.from({ length: 6 }, (_, i) => ({ name: `Samosa ${i + 1}`, qty: 1, price: 20 })) },
  })
  assert.equal(screen, 'agent-cart')
  assert.equal(model.editable, false)
  assert.equal(model.lines.length, 6)
  assert.deepEqual(focusKeysFor(screen, model), ['acart-checkout', 'acart-edit', 'acart-more', 'acart-clear'])
})

test('grocery carts with zero items render an intentional empty state; food cart with no rows safely falls back', () => {
  const emptyGrocery = screenForEnvelope({ widget: 'cart', payload: { kind: 'grocery', platform: 'Zepto', items: [], total: 0 } })
  assert.equal(emptyGrocery.screen, 'agent-cart')
  assert.deepEqual(focusKeysFor(emptyGrocery.screen, emptyGrocery.model), ['shop-more'])
  const emptyFood = screenForEnvelope({ widget: 'cart', payload: { platform: 'Swiggy', items: [], total: 0 } })
  assert.equal(emptyFood.screen, 'text')
})

test('menu and exact grocery carousel retain separate routes', () => {
  const menu = screenForEnvelope({ widget: 'menu', payload: { restaurant: 'Test Kitchen', platform: 'Zomato', items: [{ name: 'Paneer', price: 100 }] } })
  assert.equal(menu.screen, 'menu')
  const grocery = screenForEnvelope({ widget: 'carousel', payload: { kind: 'grocery', cards: [{ name: 'Milk', platform: 'Zepto', in_stock: true, price: 60 }] } })
  assert.equal(grocery.screen, 'gresults')
})
