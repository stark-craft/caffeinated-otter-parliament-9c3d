import test from 'node:test'
import assert from 'node:assert/strict'
import { QUICK_PROMPTS, quickPromptAt, modeFocusAfterArrow } from './quickPrompts.js'
import { deriveIntent } from './deriveIntent.js'
import { findVoiceCommand } from './voiceNavigation.js'
import { buildView } from './viewContext.js'

test('exactly four quick prompts cover both recipe baskets and both Zomato journeys', () => {
  assert.equal(QUICK_PROMPTS.length, 4)
  assert.deepEqual(QUICK_PROMPTS.map(({ id }) => id),
    ['chicken-biryani', 'kimchi', 'pizza-zomato', 'pav-bhaji-haldiram'])
  assert.equal(new Set(QUICK_PROMPTS.map(({ id }) => id)).size, 4)
  assert.equal(quickPromptAt(-1), null)
  assert.equal(quickPromptAt(4), null)
})

test('quick prompts enter the actual backend search intent, not local-only cards or STT', () => {
  const view = buildView({ screen: 'mode', vertical: 'food' })
  for (const prompt of QUICK_PROMPTS) {
    assert.equal(findVoiceCommand(prompt.prompt), null, prompt.id)
    const intent = deriveIntent(prompt.prompt, view)
    assert.equal(intent.name, 'search', prompt.id)
    assert.equal(intent.slots.vertical, prompt.vertical, prompt.id)
    if (prompt.vertical === 'food') {
      assert.deepEqual(intent.slots.providers, ['zomato'], prompt.id)
    } else {
      assert.deepEqual(intent.slots.providers, [], prompt.id)
    }
  }
})

test('mode remote focuses tiles, then all four prompts, then Back', () => {
  assert.equal(modeFocusAfterArrow('mode-food', 'ArrowRight'), 'mode-grocery')
  assert.equal(modeFocusAfterArrow('mode-grocery', 'ArrowLeft'), 'mode-food')
  assert.equal(modeFocusAfterArrow('mode-food', 'ArrowDown'), 'quick-prompt-0')
  for (let i = 0; i < QUICK_PROMPTS.length - 1; i++) {
    assert.equal(modeFocusAfterArrow(`quick-prompt-${i}`, 'ArrowDown'), `quick-prompt-${i + 1}`)
    assert.equal(modeFocusAfterArrow(`quick-prompt-${i + 1}`, 'ArrowUp'), `quick-prompt-${i}`)
  }
  assert.equal(modeFocusAfterArrow('quick-prompt-0', 'ArrowUp'), 'mode-food')
  assert.equal(modeFocusAfterArrow('quick-prompt-3', 'ArrowDown'), 'back')
  assert.equal(modeFocusAfterArrow('back', 'ArrowUp'), 'quick-prompt-3')
  assert.equal(modeFocusAfterArrow('quick-prompt-1', 'ArrowRight'), 'quick-prompt-1')
})
