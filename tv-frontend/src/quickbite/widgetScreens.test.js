import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { screenForEnvelope } from './widgetScreens.js'

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
