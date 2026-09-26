import test from 'node:test'
import assert from 'node:assert/strict'
import { findVoiceCommand, getHiddenVoiceTargets } from './voiceNavigation.js'
import { routeIntent } from './intents.js'

test('Bixby casing and punctuation all resolve the same local banana page', () => {
  for (const phrase of ['order banana', 'Order Banana', 'ORDER BANANA', 'Order banana', 'order Banana', 'oRdEr bAnAnA!']) {
    assert.deepEqual(findVoiceCommand(phrase), {
      type: 'grocery-product', id: 'bananas', categoryId: 'fruits-veg', index: 0, name: 'Bananas',
    })
  }
})

test('known categories and dishes navigate locally, without inventing catalog IDs', () => {
  assert.equal(findVoiceCommand('ORDER FRUITS AND VEGETABLES').id, 'fruits-veg')
  assert.equal(findVoiceCommand('Order Pav Bhaji').id, 'pao-bhaji')
  assert.equal(findVoiceCommand('Order Samosas').id, 'samosa')
  assert.equal(findVoiceCommand('Open groceries').type, 'grocery')
})

test('unknown long-tail speech remains unmatched for CommAgent backend routing', () => {
  assert.equal(findVoiceCommand('find the cheapest bananas from Zepto for delivery tonight'), null)
})

test('Samsung DOM registry includes mixed-case labels explicitly', () => {
  const labels = new Set(getHiddenVoiceTargets().map((target) => target.label))
  for (const label of ['order banana', 'Order Banana', 'Order banana', 'order Banana', 'ORDER BANANA']) {
    assert.ok(labels.has(label), label)
  }
})

test('local navigation still trips CommAgent payment-screen guard', () => {
  const decision = routeIntent(
    { name: 'go_home', confidence: 0.99, slots: {}, alternatives: [] },
    { screen: 'pay' },
  )
  assert.match(decision.strip.question, /Payment in progress/)
})
