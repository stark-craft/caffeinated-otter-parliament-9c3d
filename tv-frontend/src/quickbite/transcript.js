/* Known ASR confusions, measured against saaras:v3 and saaras:v4 (spec §6.2).
   Both reproduce on every model at baseline; keyterms on saaras:v4 fixes the
   first pair, but that needs the backend (spec §12), so they are corrected here.
   Applied to the matching copy only. The raw transcript is what gets shown to
   the user, so a wrong correction never reaches the screen. */

const CONFUSIONS = [
  [/\bcards?\b/giu, 'cart'],
  [/कार्ड/gu, 'कार्ट'],
  [/\bxiaomi\b/giu, 'show me'],
]

const TRAILING_PUNCTUATION = /[।।.,?!\s]+$/u

export function normalizeTranscript(raw) {
  let text = String(raw || '').trim()
  if (!text) return ''

  text = text.replace(TRAILING_PUNCTUATION, '')
  text = text.replace(/\s+/gu, ' ').trim()

  for (const [pattern, replacement] of CONFUSIONS) {
    text = text.replace(pattern, replacement)
  }

  return text
}

export function matchable(raw) {
  return normalizeTranscript(raw).toLowerCase()
}
