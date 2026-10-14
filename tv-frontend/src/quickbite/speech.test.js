import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSpeechEnabled, setSpeechEnabled, selectSpeechVoice, spokenAmount,
  speechText, speak, trackingAnnouncement, orderPlacedLine,
} from './speech.js'
import { findVoiceCommand } from './voiceNavigation.js'

test('spoken text strips emojis, markdown, and interactive choice tags', () => {
  const text = speechText('**Hello** 🛵\n[[CHOICES: Checkout | Cancel]]\n₹72')
  assert.match(text, /Hello/)
  assert.match(text, /seventy two rupees/)
  assert.doesNotMatch(text, /\[\[|🛵|\*\*/)
})

test('amounts use Indian spoken currency and ranges use to', () => {
  assert.equal(spokenAmount('1,200'), 'one thousand two hundred rupees')
  assert.match(speechText('₹199 - ₹250'), /one hundred ninety nine rupees to two hundred fifty rupees/)
})

test('voice commands turn optional speech on and off without a merchant', () => {
  assert.deepEqual(findVoiceCommand('voice replies on'), { type: 'speech', on: true })
  assert.deepEqual(findVoiceCommand('mute voice'), { type: 'speech', on: false })
  setSpeechEnabled(false)
  assert.equal(isSpeechEnabled(), false)
  assert.equal(speak('Hello'), false)
  setSpeechEnabled(true)
  assert.equal(isSpeechEnabled(), true)
  setSpeechEnabled(false)
})

test('Hindi voice selection never selects an English-only voice', () => {
  const voices = [{ lang: 'en-IN' }, { lang: 'hi-IN' }]
  assert.equal(selectSpeechVoice(voices, 'hi-IN').lang, 'hi-IN')
  assert.equal(selectSpeechVoice([voices[0]], 'hi-IN'), null)
  assert.equal(selectSpeechVoice(voices, 'en-IN').lang, 'en-IN')
})

test('tracking speech uses first snapshot as baseline, advances once, never backwards', () => {
  const first = trackingAnnouncement(null, { seq: 1, phase: 'preparing', rank: 2 })
  assert.equal(first.line, '')
  const second = trackingAnnouncement(first.next, { seq: 1, phase: 'on-the-way', rank: 3 })
  assert.match(second.line, /on the way/i)
  assert.equal(trackingAnnouncement(second.next, { seq: 1, phase: 'on-the-way', rank: 3 }).line, '')
  assert.equal(trackingAnnouncement(second.next, { seq: 1, phase: 'preparing', rank: 2 }).line, '')
  assert.equal(trackingAnnouncement(second.next, { seq: 2, phase: 'pay', rank: 1 }).line, '')
})

test('order completion announcements do not fabricate checkout success', () => {
  assert.match(orderPlacedLine({ payment: 'Cash on Delivery' }), /Pay the delivery partner/)
  assert.match(orderPlacedLine({ qr: 'data:image/png;base64,abc' }), /QR code/)
  assert.match(orderPlacedLine({}), /Check the provider/)
})
