import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveIntent } from '../quickbite/deriveIntent.js'
import { buildView } from '../quickbite/viewContext.js'
import { withGroceryPurchaseContext } from './useLoginContinuation.js'

test('buying packaged juice from Food preserves the utterance and asks for Grocery access', () => {
  const transcript = 'I want to buy some juice'
  const intent = deriveIntent(transcript, buildView({ screen: 'home', vertical: 'food' }))
  const routed = withGroceryPurchaseContext(transcript, intent)
  assert.equal(routed.slots.vertical, 'grocery')
  assert.equal(routed.transcript, transcript)
  assert.equal(routed.name, 'search')
  assert.equal(intent.slots.vertical, 'food', 'does not mutate the original intent')
})

test('explicit restaurant/provider requests and existing financial intents keep their routing', () => {
  for (const transcript of ['buy juice at a restaurant', 'buy juice from Zomato']) {
    const intent = deriveIntent(transcript, buildView({ screen: 'home', vertical: 'food' }))
    assert.equal(withGroceryPurchaseContext(transcript, intent), intent)
  }
  const checkout = { name: 'checkout', slots: { vertical: 'food' } }
  assert.equal(withGroceryPurchaseContext('buy milk and pay', checkout), checkout)
})
