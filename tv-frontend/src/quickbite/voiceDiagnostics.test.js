import test from 'node:test'
import assert from 'node:assert/strict'
import { newVoiceTrace, safeVoiceDetails } from './voiceDiagnostics.js'

test('voice traces distinguish utterances and sources', () => {
  assert.notEqual(newVoiceTrace('chrome-ptt'), newVoiceTrace('chrome-ptt'))
  assert.match(newVoiceTrace('samsung-stt'), /^samsung-stt-/)
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
