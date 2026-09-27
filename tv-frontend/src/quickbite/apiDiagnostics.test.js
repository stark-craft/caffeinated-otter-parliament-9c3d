import test from 'node:test'
import assert from 'node:assert/strict'
import { apiPurpose, apiResponseMismatch } from '../apiDiagnostics.js'

test('diagnostics label QR and commerce endpoints by purpose', () => {
  assert.match(apiPurpose('POST', 'http://example.test/api/qr/session'), /phone-login QR session/)
  assert.match(apiPurpose('GET', 'http://example.test/api/qr/session/AGC-1/status'), /phone login is complete/)
  assert.match(apiPurpose('POST', 'http://example.test/api/chat'), /UI envelope/)
})

test('diagnostics identify response fields required by the existing UI', () => {
  assert.match(apiResponseMismatch('POST', '/api/qr/session', {}), /session_id/)
  assert.equal(apiResponseMismatch('POST', '/api/qr/session', { session_id: 'AGC-1' }), '')
  assert.match(apiResponseMismatch('GET', '/api/qr/session/AGC-1/status', {}), /login_complete/)
  assert.equal(apiResponseMismatch('GET', '/api/qr/auth/status/zomato', { connected: false }), '')
  assert.match(apiResponseMismatch('POST', '/api/qr/auth/begin', { status: 'pending' }), /auth_url/)
  assert.equal(apiResponseMismatch('POST', '/api/qr/auth/begin', { status: 'pending', auth_url: 'https://example.test/login' }), '')
  assert.match(apiResponseMismatch('POST', '/api/session', {}), /session_id or id/)
  assert.equal(apiResponseMismatch('POST', '/api/session', { payload: { session_id: 'TV-1' } }), '')
})
