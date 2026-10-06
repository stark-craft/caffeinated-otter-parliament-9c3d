import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTrackingSnapshot, screenForTracking, trackingPhase, reconcileTrackingSnapshot, withTrackingTimeout } from './tracking.js'

test('payment incomplete is authoritative even when a generic heading says Placed', () => {
  const incomplete = { step: 'Placed', order_status: "Your order's payment is incomplete", done: false }
  assert.equal(trackingPhase(incomplete), 'pay')
  assert.equal(trackingPhase({ ...incomplete, done: true }), 'pay')
  assert.equal(trackingPhase(reconcileTrackingSnapshot({ step: 'In the kitchen' }, incomplete)), 'pay')
  assert.equal(trackingPhase(reconcileTrackingSnapshot(incomplete, { step: 'In the kitchen' })), 'preparing')
  assert.equal(reconcileTrackingSnapshot({ step: 'On the way' }, { step: 'Placed' }).step, 'On the way')
})

test('safe status checks have a deadline, preserve errors and never invoke checkout', async () => {
  assert.deepEqual(await withTrackingTimeout(Promise.resolve({ order_status: 'Awaiting payment' })), { order_status: 'Awaiting payment' })
  await assert.rejects(withTrackingTimeout(Promise.reject(new Error('Status unavailable'))), /Status unavailable/)
  await assert.rejects(withTrackingTimeout(new Promise(() => {}), 5), /did not respond/)
})

test('an out-for-delivery order remains on the way', () => {
  const snapshot = { order_status: 'Out for delivery', done: false }
  assert.equal(trackingPhase(snapshot), 'on-the-way')
  assert.equal(screenForTracking(snapshot), 'on-the-way')
})

test('tracking phases distinguish payment, preparation, completion and cancellation', () => {
  assert.equal(trackingPhase({ status: 'Awaiting payment' }), 'pay')
  assert.equal(trackingPhase({ step: 'Preparing your order' }), 'preparing')
  assert.equal(trackingPhase({ status: 'Delivered' }), 'delivered')
  assert.equal(trackingPhase({ status: 'Out for delivery', done: true }), 'delivered')
  assert.equal(trackingPhase({ status: 'Cancelled', done: true }), 'cancelled')
  assert.equal(trackingPhase({ status: 'Cancellation requested' }), 'unknown')
})

test('nested tracking response keeps order id and payment QR', () => {
  const result = normalizeTrackingSnapshot({ payload: { tracking: { order_id: 'ORD-7', payment_qr: 'data:image/png;base64,abc' }, status: 'Awaiting payment' } })
  assert.equal(result.order_id, 'ORD-7')
  assert.equal(result.payment_qr, 'data:image/png;base64,abc')
  assert.equal(trackingPhase(result), 'pay')
})

test('tracking ETA survives direct, nested and minute-based provider responses', () => {
  assert.equal(normalizeTrackingSnapshot({ eta: '25–30 min' }).eta, '25–30 min')
  assert.equal(normalizeTrackingSnapshot({ payload: { tracking: { delivery_eta: '18 min' } } }).eta, '18 min')
  assert.equal(normalizeTrackingSnapshot({ payload: { eta_minutes: 12 } }).eta, '12 min')
})

const vanished = { waiting: true, step: null, order_id: null, done: false }
const instamart = { server: 'swiggy_instamart', kind: 'grocery', order_id: '250237112920408' }
const preparing = { order_id: instamart.order_id, step: 'Preparing', done: false }
test('known active Instamart COD order disappearance cancels before monotonic progression', () => {
  const next = reconcileTrackingSnapshot(preparing, normalizeTrackingSnapshot(vanished), { descriptor: instamart, payment: 'Cash on Delivery' })
  assert.equal(trackingPhase(next), 'cancelled')
  assert.equal(screenForTracking(next), 'cancelled')
  assert.equal(next.order_id, instamart.order_id)
  assert.equal(next.done, true)
  assert.equal(trackingPhase(reconcileTrackingSnapshot(next, preparing)), 'cancelled')
})
test('fresh waiting, payment pending, ambiguous data and other contracts do not infer cancellation', () => {
  for (const [previous, response, descriptor, payment] of [
    [null, vanished, instamart, 'COD'],
    [{ ...preparing, order_id: null }, vanished, instamart, 'COD'],
    [{ ...preparing, step: 'Confirming payment' }, vanished, instamart, 'COD'],
    [preparing, { waiting: true, order_id: null }, instamart, 'COD'],
    [preparing, { waiting: true, step: null, done: false }, instamart, 'COD'],
    [preparing, { waiting: true, step: null, order_id: null }, instamart, 'COD'],
    [preparing, vanished, { ...instamart, order_id: 'OTHER-ORDER' }, 'COD'],
    [preparing, { ...vanished, error: 'Service unavailable' }, instamart, 'COD'],
    [preparing, { ...vanished, stale: true }, instamart, 'COD'],
    [preparing, vanished, { ...instamart, server: 'zomato', kind: 'food' }, 'COD'],
    [preparing, vanished, instamart, 'UPI'],
    [preparing, vanished, instamart, ''],
  ]) assert.notEqual(trackingPhase(reconcileTrackingSnapshot(previous, normalizeTrackingSnapshot(response), { descriptor, payment })), 'cancelled')
})
test('explicit Cancelled/Canceled status overrides a stale Preparing heading', () => {
  for (const status of ['Cancelled', 'Canceled']) {
    const next = reconcileTrackingSnapshot(preparing, { ...preparing, order_status: status })
    assert.equal(trackingPhase(next), 'cancelled')
  }
})
