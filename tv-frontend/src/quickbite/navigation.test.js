import assert from 'node:assert/strict'
import test from 'node:test'
import { backTarget, qrFocusAfterArrow, recordScreenVisit, takePreviousScreen } from './navigation.js'

test('Back returns to the menu that preceded item review, not a fixed restaurant parent', () => {
  let history = []
  history = recordScreenVisit(history, 'restaurant', 'menu')
  history = recordScreenVisit(history, 'menu', 'review')
  const previous = takePreviousScreen(history)
  assert.equal(previous.screen, 'menu')
  assert.deepEqual(previous.history, ['restaurant'])
})

test('a voice result replaces its temporary loading view in Back history', () => {
  let history = recordScreenVisit([], 'category', 'text')
  history = recordScreenVisit(history, 'text', 'restaurant', { replace: true })
  assert.equal(takePreviousScreen(history).screen, 'category')
})

test('fallback map remains available when a screen has no recorded predecessor', () => {
  assert.equal(takePreviousScreen([]).screen, null)
  assert.equal(backTarget('cart', 'grocery', null), 'greview')
})

test('QR actions have a deterministic remote arrow focus path', () => {
  assert.equal(qrFocusAfterArrow('retry', 'ArrowDown', true), 'close')
  assert.equal(qrFocusAfterArrow('close', 'ArrowUp', true), 'retry')
  assert.equal(qrFocusAfterArrow('retry', 'ArrowDown', false), 'close')
})
