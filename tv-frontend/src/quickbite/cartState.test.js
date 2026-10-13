import test from 'node:test'
import assert from 'node:assert/strict'
import { cartClearConfirmed, cartClearRequestPrompt, cartReadbackPrompt, verifiedEmptyCart } from './cartState.js'
import { isCartDestructiveAction, isCheckoutDeclineAction } from './widgetScreens.js'

test('Cart deletion is distinct from declining checkout', () => {
  for (const label of ['Clear cart', 'Cancel cart', 'clear my cart']) assert.equal(isCartDestructiveAction(label), true)
  for (const label of ['No, cancel', 'No, cancel it', 'Cancel order', 'Cancel my order', 'No, thanks', 'Show cart']) assert.equal(isCartDestructiveAction(label), false)
  assert.equal(isCheckoutDeclineAction('No, cancel'), true)
  assert.equal(isCheckoutDeclineAction('Clear cart'), false)
})
test('Food and Grocery clears require an explicit empty cart or confirmed cart-clear result', () => {
  for (const platform of ['Zomato', 'Swiggy Instamart', 'Zepto']) {
    assert.equal(cartClearConfirmed({ widget: 'cart', payload: { platform, items: [], total: 0 } }), true)
    assert.equal(cartClearConfirmed({ widget: 'text', text: 'Your cart has been cleared.' }), true)
    assert.equal(cartClearConfirmed({ widget: 'text', payload: { status: 'cart_cancelled' } }), true)
  }
})
test('checkout declines, failures, incomplete cart data and placed orders do not clear a cart', () => {
  for (const envelope of [
    { text: 'Checkout cancelled. Your cart is unchanged.' },
    { text: 'Could not clear cart.' }, { text: 'Your cart was not cleared.' },
    { text: 'Cart cancellation pending.' }, { widget: 'cart', payload: { platform: 'Zepto' } },
    { widget: 'cart', payload: { items: [{ name: 'Milk' }], total: 0 }, text: 'Cart cleared' },
    { widget: 'cart', payload: { items: [], total: 12 } },
    { text: 'Cart cleared', tracking: { order_id: 'ORD-1' } },
    { text: 'Cart cleared', order_id: 'ORD-1', payment_method: 'COD', status: 'Placed' },
    { text: 'Cart cleared', payment_qr: 'https://example.test/qr.png' },
  ]) assert.equal(cartClearConfirmed(envelope), false, JSON.stringify(envelope))
})


test('Verifiable empty cart must come from structured provider readback', () => {
  assert.equal(verifiedEmptyCart({ widget: 'cart', payload: { items: [], total: 0 } }), true)
  assert.equal(verifiedEmptyCart({ widget: 'text', text: 'Your cart has been cleared.' }), false)
  assert.equal(verifiedEmptyCart({ widget: 'cart', payload: { items: [], total: null } }), false)
  assert.equal(verifiedEmptyCart({ widget: 'cart', payload: { items: [{ name: 'Milk' }], total: 0 } }), false)
  assert.equal(verifiedEmptyCart({ widget: 'cart', payload: { items: [], total: 0 }, tracking: { order_id: 'ORDER-1' } }), false)
  const clear = cartClearRequestPrompt('Swiggy', 'grocery')
  assert.match(clear, /Swiggy Instamart/)
  assert.match(clear, /every item/)
  assert.match(cartReadbackPrompt('Zepto', 'grocery'), /Read-only verification/)
  assert.equal(cartClearRequestPrompt('unknown'), '')
})
