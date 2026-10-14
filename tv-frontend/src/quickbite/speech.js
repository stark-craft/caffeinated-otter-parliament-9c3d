// Optional TV voice replies. No dependency on STT and safe in Node.
let enabled = false

export function setSpeechEnabled(next) {
  enabled = Boolean(next)
  if (!enabled && typeof window !== 'undefined') {
    try { window.speechSynthesis?.cancel?.() } catch { /* optional TV feature */ }
  }
  return enabled
}

export function isSpeechEnabled() { return enabled }

function numberWords(n) {
  const ones = ['zero','one','two','three','four','five','six','seven','eight','nine',
    'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
    'eighteen','nineteen']
  const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' +
    (n % 100 ? ' ' + numberWords(n % 100) : '')
  for (const [size, label] of [[10000000,'crore'],[100000,'lakh'],[1000,'thousand']]) {
    if (n >= size) return numberWords(Math.floor(n / size)) + ' ' + label +
      (n % size ? ' ' + numberWords(n % size) : '')
  }
  return String(n)
}

export function spokenAmount(value) {
  const raw = String(value ?? '').replace(/,/g, '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return raw
  const [major, fraction] = raw.split('.')
  const amount = Number(major)
  if (!Number.isSafeInteger(amount)) return raw + ' rupees'
  const rupees = numberWords(amount) + (amount === 1 ? ' rupee' : ' rupees')
  if (!fraction || !Number(fraction)) return rupees
  const paise = Number(fraction.padEnd(2, '0').slice(0, 2))
  return rupees + ' and ' + numberWords(paise) + ' paise'
}

export function speechText(value, maxLength = 430) {
  let output = String(value ?? '')
    .replace(/\[\[CHOICES?:[\s\S]*?\]\]/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/gu, '$1')
    .replace(/\*\*|__|\x60|#{1,6}(?=\s)/gu, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[\u2022\u25CF\u25AA\u25AB]/gu, ' ')
    .replace(/\r?\n+/gu, '. ')
  output = output.replace(/₹\s*(\d[\d,]*(?:\.\d{1,2})?)\s*[–—-]\s*₹\s*(\d[\d,]*(?:\.\d{1,2})?)/gu,
    (_, a, b) => spokenAmount(a) + ' to ' + spokenAmount(b))
  output = output.replace(/₹\s*(\d[\d,]*(?:\.\d{1,2})?)/gu, (_, value) => spokenAmount(value))
    .replace(/\s+[–—-]\s+(?=[^\s])/gu, ', ')
    .replace(/\s+([,.;!?])/gu, '$1')
    .replace(/[\t ]+/gu, ' ')
    .replace(/(?:\.\s*){2,}/gu, '. ')
    .trim()
  if (output.length > maxLength) {
    const shortened = output.slice(0, maxLength)
    const end = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf('? '), shortened.lastIndexOf('! '))
    const lastSpace = shortened.lastIndexOf(' ')
    output = (end > maxLength * .45 ? shortened.slice(0, end + 1) :
      shortened.slice(0, lastSpace > 0 ? lastSpace : maxLength)).trim()
  }
  return output
}

export const sanitizeSpeechText = speechText

export function selectSpeechVoice(voices, language = 'en-IN') {
  const available = Array.isArray(voices) ? voices : []
  const requested = String(language || 'en-IN').toLowerCase()
  const base = requested.split('-')[0]
  return available.find(v => String(v.lang || '').toLowerCase() === requested) ||
    available.find(v => String(v.lang || '').toLowerCase().split('-')[0] === base) ||
    null
}

export function speak(value, { lang = 'en-IN', log = () => {} } = {}) {
  const text = speechText(value)
  if (!enabled || !text) { log('skipped', { enabled, hasText: Boolean(text) }); return false }
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    log('unavailable', { reason: 'No speechSynthesis API' })
    return false
  }
  const synthesizer = window.speechSynthesis
  const Utterance = typeof SpeechSynthesisUtterance !== 'undefined'
    ? SpeechSynthesisUtterance : window.SpeechSynthesisUtterance
  if (typeof Utterance !== 'function') {
    log('unavailable', { reason: 'No SpeechSynthesisUtterance' })
    return false
  }
  try {
    const voices = synthesizer.getVoices?.() || []
    const actualLanguage = /[\u0900-\u097F]/u.test(text) ? 'hi-IN' : lang
    const voice = selectSpeechVoice(voices, actualLanguage)
    if (actualLanguage.toLowerCase().startsWith('hi') && !voice) {
      log('unavailable', { reason: 'Hindi voice unavailable' })
      return false
    }
    const utterance = new Utterance(text)
    utterance.lang = voice?.lang || actualLanguage
    if (voice) utterance.voice = voice
    utterance.rate = 1
    utterance.pitch = 1
    synthesizer.cancel?.()
    synthesizer.speak(utterance)
    log('speaking', { lang: utterance.lang, length: text.length })
    return true
  } catch (error) {
    log('failed', { message: error?.message || String(error) })
    return false
  }
}

export function orderPlacedLine({ qr, payment, amount } = {}) {
  const value = Number(amount)
  const total = Number.isFinite(value) && value > 0 ? ' Total ₹' + value + '.' : ''
  const method = String(typeof payment === 'string' ? payment :
    payment?.method || payment?.type || '').toLowerCase()
  if (/\bcod\b|cash on delivery/u.test(method)) {
    return 'Your order was placed.' + total + ' Pay the delivery partner when it arrives.'
  }
  if (qr) return 'Your order was placed.' + total +
    ' Complete payment using the QR code on your phone.'
  return 'Your order request was submitted.' + total +
    ' Check the provider for confirmation and payment status.'
}

const MILESTONES = Object.freeze({
  pay: 'Payment status updated.',
  preparing: 'Your order is being prepared.',
  'on-the-way': 'Your order is on the way.',
  delivered: 'Your order has been delivered.',
  cancelled: 'Your order was cancelled.',
})

export function trackingAnnouncement(previous, { seq, phase, rank } = {}) {
  if (!seq || !phase) return { next: previous, line: '' }
  const currentRank = Number.isFinite(rank) ? rank :
    ({ unknown: 0, pay: 1, preparing: 2, 'on-the-way': 3, delivered: 4, cancelled: 99 }[phase] ?? 0)
  const next = { seq, phase, rank: currentRank }
  if (!previous || previous.seq !== seq) return { next, line: '' }
  if (phase === previous.phase || currentRank < previous.rank) return { next: previous, line: '' }
  return { next, line: MILESTONES[phase] || '' }
}
