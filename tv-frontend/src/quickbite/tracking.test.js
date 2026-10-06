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
