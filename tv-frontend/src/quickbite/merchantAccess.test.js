import test from 'node:test'
import assert from 'node:assert/strict'
import { anyMerchantConnected, verticalUnlocked } from './merchantAccess.js'

test('unknown or missing connections do not unlock shopping', () => {
  assert.equal(anyMerchantConnected({}, []), false)
  assert.equal(verticalUnlocked({}, [], 'food'), false)
  assert.equal(verticalUnlocked({}, [], 'grocery'), false)
})

test('Zomato unlocks Food but not Grocery', () => {
  const statuses = { zomato: true, swiggy: false, zepto: false }
  assert.equal(verticalUnlocked(statuses, [], 'food'), true)
  assert.equal(verticalUnlocked(statuses, [], 'grocery'), false)
})

test('Swiggy unlocks Food and Instamart Grocery', () => {
  const statuses = { zomato: false, swiggy: true, zepto: false }
  assert.equal(verticalUnlocked(statuses, [], 'food'), true)
  assert.equal(verticalUnlocked(statuses, [], 'grocery'), true)
})

test('Zepto unlocks Grocery but not Food', () => {
  const statuses = { zomato: false, swiggy: false, zepto: true }
  assert.equal(verticalUnlocked(statuses, [], 'food'), false)
  assert.equal(verticalUnlocked(statuses, [], 'grocery'), true)
})

test('a failed QR status check can fall back to explicit commerce session flags', () => {
  const platforms = [{ name: 'Swiggy', connected: true }]
  assert.equal(verticalUnlocked({ swiggy: null }, platforms, 'grocery'), true)
  assert.equal(verticalUnlocked({ swiggy: false }, platforms, 'grocery'), false)
})
