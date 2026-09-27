import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmedCodCheckout, orderPlatform, paymentMethodFromEnvelope, paymentPresentation } from './payMode.js'

test('an actual payment QR overrides platform defaults', () => {
  assert.equal(paymentPresentation({ platform: 'Swiggy', payment: 'COD', qr: 'data:image/png;base64,abc' }), 'qr')
  assert.equal(paymentPresentation({ platform: 'Zepto', payment: 'UPI' }), 'qr')
  assert.equal(paymentPresentation({ platform: 'Swiggy', payment: { method: 'Online UPI' } }), 'qr')
})

test('cash on delivery requires an explicit payment method', () => {
  assert.equal(paymentPresentation({ platform: 'Swiggy', payment: 'Cash on delivery' }), 'cod')
  assert.equal(paymentPresentation({ platform: 'Swiggy', payment: 'CASH_ON_DELIVERY' }), 'cod')
  assert.equal(paymentPresentation({ platform: 'Zomato', payment: 'Cash' }), 'cod')
  assert.equal(paymentPresentation({ platform: 'Zomato', payment: 'UPI or COD' }), 'unknown')
  assert.equal(paymentPresentation({ platform: 'Zepto' }), 'unknown')
  assert.equal(paymentPresentation({ platform: 'Zomato' }), 'qr')
})

test('tracking platform takes precedence over selection labels', () => {
  assert.equal(orderPlatform({ tracking: { platform: 'Swiggy' }, cart: { platform: 'Zomato' } }), 'Swiggy')
  assert.equal(orderPlatform({ cart: { store: 'Zepto' }, groceryCard: { platform: 'Instamart' } }), 'Zepto')
})

test('a COD-only checkout needs an explicit method, order ID and placed status', () => {
  const confirmed = { payload: { order: { order_id: 'ORD-18', status: 'ORDER_PLACED', payment_method: 'Cash on delivery' } } }
  assert.equal(paymentMethodFromEnvelope(confirmed), 'Cash on delivery')
  assert.equal(confirmedCodCheckout(confirmed), true)
  assert.equal(confirmedCodCheckout({ order_id: 'ORD-19', order_status: 'ORDER_CONFIRMED', payment_method: 'CASH_ON_DELIVERY' }), true)
  assert.equal(confirmedCodCheckout({ payload: { order: { status: 'ORDER_PLACED', payment_method: 'COD' } } }), false)
  assert.equal(confirmedCodCheckout({ payload: { order: { order_id: 'ORD-18', status: 'Payment pending', payment_method: 'COD' } } }), false)
  assert.equal(confirmedCodCheckout({ payload: { order: { order_id: 'ORD-18', status: 'ORDER_PLACED', payment_method: 'UPI' } } }), false)
})
