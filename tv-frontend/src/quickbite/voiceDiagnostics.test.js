import test from 'node:test'
import assert from 'node:assert/strict'
import { newVoiceTrace, safeVoiceDetails } from './voiceDiagnostics.js'

test('voice traces distinguish utterances and sources', () => {
  assert.notEqual(newVoiceTrace('chrome-ptt'), newVoiceTrace('chrome-ptt'))
  assert.match(newVoiceTrace('samsung-stt'), /^samsung-stt-/)
})

test('diagnostics preserve repeated intent/view references while stopping actual cycles', () => {
  const providers = ['zomato']
  const value = { intent: { providers }, expectedProviders: providers }
  value.self = value
  const safe = safeVoiceDetails(value)
  assert.deepEqual(safe.expectedProviders, ['zomato'])
  assert.equal(safe.self, '[circular]')
})

test('commerce diagnostics redact credentials, pairing IDs and payment targets', () => {
  const safe = safeVoiceDetails({ session_id: 'private', refresh_token: 'private', phone: 'private',
    payload: { auth_url: 'private', code_verifier: 'private', payment_qr: 'private', upi_uri: 'private' },
    url: 'https://name:private@example.com/path?token=private', header: 'Bearer private',
    pairing: 'https://example.com/api/qr/session/private/status' })
  assert.doesNotMatch(JSON.stringify(safe), /private/)
  assert.match(safe.url, /parameters omitted/)
})

test('voice diagnostics preserve useful envelope fields without logging credentials or huge images', () => {
  const details = safeVoiceDetails({
    transcript: 'order bananas',
    session_id: 'private-session',
    payload: { widget: 'cards', accessToken: 'private-token', images: ['x'.repeat(2500)] },
  })
  assert.equal(details.transcript, 'order bananas')
  assert.equal(details.session_id, '[redacted]')
  assert.equal(details.payload.accessToken, '[redacted]')
  assert.match(details.payload.images[0], /omitted/)
})
