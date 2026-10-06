import assert from 'node:assert/strict'
import test from 'node:test'
import { paymentQrFromEnvelope, trackingFromEnvelope } from './envelopes.js'
import { confirmedCodCheckout } from './payMode.js'

test('a Zomato tracking descriptor and tracking URL cannot manufacture a payment QR', () => {
  const checkout = { widget: 'text', text: 'Your order is placed!', images: [], tracking: { server: 'zomato', order_id: 'TEST-ORDER', ctx: {} }, vendor_widget: null }
  assert.equal(trackingFromEnvelope(checkout).order_id, 'TEST-ORDER')
  assert.equal(paymentQrFromEnvelope(checkout), '')
  assert.equal(paymentQrFromEnvelope({ step: 'Confirming payment', order_status: "Your order's payment is incomplete", tracking_url: 'https://zoma.to/t/EXAMPLE' }), '')
})

test('explicit payment QR wins over unrelated envelope images', () => {
  const result = paymentQrFromEnvelope({ tracking: { payment_qr: 'data:image/png;base64,qr' }, images: ['https://example.com/item.png'] })
  assert.equal(result, 'data:image/png;base64,qr')
})

test('checkout can use the existing backend image fallback', () => {
  assert.equal(paymentQrFromEnvelope({ images: ['data:image/png;base64,qr'] }), 'data:image/png;base64,qr')
})

test('generic widget images are not mistaken for a payment QR', () => {
  assert.equal(paymentQrFromEnvelope({ widget: 'comparison', images: ['https://example.com/item.png'] }, { allowImageFallback: false }), '')
})

test('nested tracking descriptor and payment QR remain attached to the same order', () => {
  const envelope = { payload: { tracking: { order_id: 'ORD-9', payment_qr: 'data:image/png;base64,qr' } } }
  assert.equal(trackingFromEnvelope(envelope)?.order_id, 'ORD-9')
  assert.equal(paymentQrFromEnvelope(envelope), 'data:image/png;base64,qr')
})

test('a confirmed COD order does not turn an unrelated image into a UPI QR', () => {
  const envelope = {
    payment_method: 'COD', order_id: 'ORD-10', order_status: 'Placed',
    images: ['https://example.com/food.png'],
  }
  assert.equal(confirmedCodCheckout(envelope), true)
  assert.equal(paymentQrFromEnvelope(envelope, { allowImageFallback: !confirmedCodCheckout(envelope) }), '')
})
