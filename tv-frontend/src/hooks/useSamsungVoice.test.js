import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSamsungContentContext } from './useSamsungVoice.js'

test('Samsung title context contains real labels and case variants', () => {
  const result = buildSamsungContentContext({
    buildVoiceInteractionContentContextItem: (positionX, positionY, title, alias) => ({ positionX, positionY, title, alias }),
    buildVoiceInteractionContentContextResponse: (items) => JSON.stringify(items),
  })
  const items = JSON.parse(result)
  const bananas = items.find((item) => item.title === 'Bananas')
  assert.ok(bananas)
  assert.ok(bananas.alias.includes('order banana'))
  assert.ok(bananas.alias.includes('Order banana'))
  assert.ok(bananas.alias.includes('ORDER BANANA'))
})
