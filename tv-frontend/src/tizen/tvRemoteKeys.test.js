import test from 'node:test'
import assert from 'node:assert/strict'
import { tvRemoteKey } from './tvRemoteKeys.js'

test('Samsung OK and Back codes map to panel navigation keys', () => {
  assert.equal(tvRemoteKey({ key: 'Unidentified', keyCode: 13 }), 'Enter')
  assert.equal(tvRemoteKey({ key: 'Unidentified', keyCode: 10009 }), 'Backspace')
  assert.equal(tvRemoteKey({ key: 'OK' }), 'Enter')
  assert.equal(tvRemoteKey({ key: 'Backspace', keyCode: 8 }), 'Backspace')
  assert.equal(tvRemoteKey({ key: 'Unidentified', keyCode: 8 }), 'Backspace')
  assert.equal(tvRemoteKey({ key: 'Back' }), 'Backspace')
})

test('Samsung directional and media keys retain their actions', () => {
  assert.equal(tvRemoteKey({ key: '', keyCode: 37 }), 'ArrowLeft')
  assert.equal(tvRemoteKey({ key: '', keyCode: 10252 }), 'MediaPlayPause')
  assert.equal(tvRemoteKey({ key: 'ArrowDown', keyCode: 40 }), 'ArrowDown')
  assert.equal(tvRemoteKey({ key: 'Left' }), 'ArrowLeft')
  assert.equal(tvRemoteKey({ key: 'Right' }), 'ArrowRight')
})
