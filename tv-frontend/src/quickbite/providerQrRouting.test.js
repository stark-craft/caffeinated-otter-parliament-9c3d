import test from 'node:test'
import assert from 'node:assert/strict'
import { providerResponseProblem, requestedProviders, responseProviders } from './providers.js'
import { deriveIntent } from './deriveIntent.js'
import { merchantConnected } from './merchantAccess.js'

test('explicit provider requests do not inherit another merchant login', () => {
  const statuses = { zomato: true, swiggy: false, zepto: false }
  const id = requestedProviders('order milk from Zepto')[0]
  assert.equal(id, 'zepto')
  assert.equal(merchantConnected(statuses, [], 'zepto'), false)
  assert.equal(merchantConnected(statuses, [], 'zomato'), true)
})

test('named Swiggy Instamart is preserved as the grocery provider', () => {
  assert.deepEqual(requestedProviders('order apples from Swiggy Instamart'), ['swiggy_instamart'])
  const intent = deriveIntent('open Zepto', { vertical: 'food', items: [] })
  assert.equal(intent.slots.provider, 'zepto')
})

test('bare Swiggy in a cart cannot falsely override explicit Instamart evidence', () => {
  const envelope = { widget: 'cart', payload: { platform: 'Swiggy',
    cart: { platform: 'Swiggy', lines: [{ platform: 'Swiggy Instamart', name: 'Milk' }] } } }
  assert.deepEqual(responseProviders(envelope), ['swiggy_instamart'])
  assert.equal(providerResponseProblem({ slots: { providers: ['swiggy_instamart'] } }, envelope), null)
})

test('bare Swiggy vendor widget also defers to explicit Instamart evidence', () => {
  const envelope = { vendor_widget: { server: 'Swiggy' },
    payload: { items: [{ platform: 'Swiggy Instamart' }] } }
  assert.deepEqual(responseProviders(envelope), ['swiggy_instamart'])
})

test('backend not-logged-in response prompts the requested Zepto QR despite alternative actions', () => {
  const envelope = { widget: 'text', text:
    'Zepto is not logged in in this session. Do you want to continue with Swiggy Instamart?',
    actions: ['Swiggy Instamart', 'No'] }
  assert.deepEqual(providerResponseProblem({ slots: { providers: ['zepto'] } }, envelope), {
    kind: 'provider-unavailable', provider: 'zepto', message: envelope.text,
  })
})

test('a true provider mismatch is still detected', () => {
  const envelope = { widget: 'carousel', payload: { cards: [{ platform: 'Swiggy Food' }] } }
  assert.equal(providerResponseProblem(
    { slots: { providers: ['swiggy_instamart'] } }, envelope,
  )?.kind, 'provider-mismatch')
})
