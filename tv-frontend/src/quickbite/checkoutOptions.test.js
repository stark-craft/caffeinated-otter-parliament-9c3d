import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutActionLabels, checkoutOptionsRequest } from './checkoutOptions.js'

test('checkout buttons come from the backend, including nested payload actions', () => {
  assert.deepEqual(checkoutActionLabels({ actions: [' Checkout ', ' No, cancel '] }), ['Checkout', 'No, cancel'])
  assert.deepEqual(checkoutActionLabels({ actions: [], payload: { actions: ['Pay with COD', 'Keep shopping'] } }),
    ['Pay with COD', 'Keep shopping'])
  assert.deepEqual(checkoutActionLabels({ payload: { actions: ['Review order'] } }), ['Review order'])
  assert.deepEqual(checkoutActionLabels({ widget: 'cart', payload: { items: [{ name: 'Milk' }] } }), [])
})

test('missing provider choices can only trigger a read-only options request', () => {
  for (const [label, vertical] of [['Zepto', 'grocery'], ['Swiggy', 'grocery'], ['Swiggy', 'food'], ['Zomato', 'food']]) {
    const prompt = checkoutOptionsRequest(label, vertical)
    assert.match(prompt, /read-only inquiry/i)
    assert.match(prompt, /return any available checkout \/ decline choices/i)
    assert.match(prompt, /Do NOT submit checkout, pay, place an order, or cancel an existing order/i)
  }
  assert.equal(checkoutOptionsRequest('unknown'), '')
})
