import test from 'node:test'
import assert from 'node:assert/strict'
import { isBixbyVoiceKey, registerBixbyVoiceKey, unregisterBixbyVoiceKey } from './bixbyVoice.js'

test('only XF86BTVoice is the Bixby voice key', () => {
  assert.equal(isBixbyVoiceKey({ key: 'XF86BTVoice' }), true)
  assert.equal(isBixbyVoiceKey({ key: 'Enter' }), false)
})

test('BTVoice is registered through Samsung appcommon once per lifecycle', () => {
  const previous = globalThis.window
  const calls = []
  globalThis.window = { webapis: { appcommon: {
    registerKey: (keys) => calls.push(['register', keys]),
    unregisterKey: (keys) => calls.push(['unregister', keys]),
  } } }
  try {
    assert.equal(registerBixbyVoiceKey(), true)
    unregisterBixbyVoiceKey()
    assert.deepEqual(calls, [
      ['register', ['BTVoice']], ['unregister', ['BTVoice']],
    ])
  } finally {
    globalThis.window = previous
  }
})
