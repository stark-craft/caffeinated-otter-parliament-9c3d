export function normalizeAudioMime(mimeType) {
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase()
  return base || 'audio/webm'
}
