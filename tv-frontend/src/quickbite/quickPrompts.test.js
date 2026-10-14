import test from 'node:test'
import assert from 'node:assert/strict'
import { QUICK_PROMPTS, quickPromptAt, modeFocusAfterArrow } from './quickPrompts.js'
import { deriveIntent } from './deriveIntent.js'
import { findVoiceCommand } from './voiceNavigation.js'
import { buildView } from './viewContext.js'

test('ten Quick Prompts cover grocery, food discovery and exact Zomato order scenarios', () => {
  assert.equal(QUICK_PROMPTS.length, 10)
  assert.deepEqual(QUICK_PROMPTS.map(({ id }) => id),
    ['kimchi-zepto', 'chicken-biryani-zepto', 'veg-biryani-instamart', 'poha-instamart',
      'ten-samosa-mithaas-zomato', 'eight-samosa-hadiram-zomato',
      'pizza-zomato', 'pav-bhaji-zomato', 'biryani-swiggy', 'dosa-swiggy'])
  assert.equal(new Set(QUICK_PROMPTS.map(({ id }) => id)).size, 10)
  assert.equal(quickPromptAt(-1), null)
  assert.equal(quickPromptAt(10), null)
})

test('quick prompts enter the actual backend search intent, not local-only cards or STT', () => {
  const view = buildView({ screen: 'mode', vertical: 'food' })
  for (const prompt of QUICK_PROMPTS) {
    assert.equal(findVoiceCommand(prompt.prompt), null, prompt.id)
    const intent = deriveIntent(prompt.prompt, view)
    assert.equal(intent.name, 'search', prompt.id)
    assert.equal(intent.slots.vertical, prompt.vertical, prompt.id)
    const expected = prompt.id.endsWith('zepto') ? 'zepto'
      : prompt.id.endsWith('instamart') ? 'swiggy_instamart'
      : prompt.id.endsWith('zomato') ? 'zomato' : 'swiggy_food'
    assert.deepEqual(intent.slots.providers, [expected], prompt.id)
  }
})

test('mode remote focuses tiles, then all ten prompts, then Back', () => {
  assert.equal(modeFocusAfterArrow('mode-food', 'ArrowRight'), 'mode-grocery')
  assert.equal(modeFocusAfterArrow('mode-grocery', 'ArrowLeft'), 'mode-food')
  assert.equal(modeFocusAfterArrow('mode-food', 'ArrowDown'), 'quick-prompt-0')
  for (let i = 0; i < QUICK_PROMPTS.length - 1; i++) {
    assert.equal(modeFocusAfterArrow(`quick-prompt-${i}`, 'ArrowDown'), `quick-prompt-${i + 1}`)
    assert.equal(modeFocusAfterArrow(`quick-prompt-${i + 1}`, 'ArrowUp'), `quick-prompt-${i}`)
  }
  assert.equal(modeFocusAfterArrow('quick-prompt-0', 'ArrowUp'), 'mode-food')
  assert.equal(modeFocusAfterArrow('quick-prompt-9', 'ArrowDown'), 'back')
  assert.equal(modeFocusAfterArrow('back', 'ArrowUp'), 'quick-prompt-9')
  assert.equal(modeFocusAfterArrow('quick-prompt-1', 'ArrowRight'), 'quick-prompt-1')
  assert.equal(modeFocusAfterArrow('mode-food', 'ArrowUp'), 'screen-heading')
  assert.equal(modeFocusAfterArrow('screen-heading', 'ArrowDown'), 'mode-food')
})

test('samosa Quick Prompts send exact user wording, provider, restaurant and quantities', () => {
  const examples = [
    ['ten-samosa-mithaas-zomato', 'Order 10 samosa from Mithaas from ZOMATO', 10, 'Mithaas'],
    ['eight-samosa-hadiram-zomato', 'Order 8 samosa from ZOMATO from hadiram', 8, 'hadiram'],
  ]
  const view = buildView({ screen: 'mode', vertical: 'food' })
  for (const [id, utterance, quantity, restaurant] of examples) {
    const entry = QUICK_PROMPTS.find(prompt => prompt.id === id)
    assert.ok(entry, id)
    assert.equal(entry.prompt, utterance)
    assert.equal(entry.vertical, 'food')
    assert.equal(entry.category, 'Zomato')
    assert.ok(entry.prompt.includes(String(quantity)))
    assert.ok(entry.prompt.includes(restaurant))
    assert.equal(findVoiceCommand(entry.prompt), null, id)
    const intent = deriveIntent(entry.prompt, view)
    assert.equal(intent.name, 'search', id)
    assert.deepEqual(intent.slots.providers, ['zomato'], id)
    assert.equal(intent.slots.vertical, 'food', id)
  }
})
