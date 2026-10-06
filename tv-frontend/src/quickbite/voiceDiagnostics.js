let traceSequence = 0

export function newVoiceTrace(source) {
  traceSequence += 1
  return `${source}-${Date.now().toString(36)}-${traceSequence}`
}

const PRIVATE_KEY = /(?:token|secret|password|authorization|cookie|session.?id|api.?key|oauth|credential|auth.?url|code.?verifier|phone|address|vpa|payment.?qr|qr.?code|payment.?url|upi.?uri)/i

export function safeVoiceDetails(value, depth = 0, seen = new WeakSet()) {
  if (typeof value === 'string') {
    if (/^(?:data:image\/|upi:|Bearer\s)/i.test(value)) return '[payment/image/credential data omitted]'
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value)
        url.username = ''
        url.password = ''
        url.pathname = url.pathname.replace(/(\/qr\/session\/)[^/]+(\/(?:status|validate|complete)$)/, '$1[redacted]$2')
        if (url.search || url.hash) { url.search = ''; url.hash = ''; return `${url.href} [parameters omitted]` }
        return url.href
      } catch { return '[invalid URL omitted]' }
    }
    return value.length > 2400
      ? `${value.slice(0, 2400)}… [${value.length - 2400} more characters omitted]`
      : value
  }
  if (value == null || typeof value !== 'object') return value
  if (seen.has(value)) return '[circular]'
  if (depth >= 8) return '[nested value omitted]'
  seen.add(value)
  if (Array.isArray(value)) {
    const items = value.slice(0, 100).map((item) => safeVoiceDetails(item, depth + 1, seen))
    if (value.length > 100) items.push(`[${value.length - 100} more items omitted]`)
    seen.delete(value)
    return items
  }
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    result[key] = PRIVATE_KEY.test(key) ? '[redacted]' : safeVoiceDetails(item, depth + 1, seen)
  }
  seen.delete(value)
  return result
}

export function voiceLog(traceId, stage, details) {
  console.log(`[VoiceFlow][${traceId || 'system'}] ${stage}`, safeVoiceDetails(details))
}

export function voiceWarn(traceId, stage, details) {
  console.warn(`[VoiceFlow][${traceId || 'system'}] ${stage}`, safeVoiceDetails(details))
}

export function voiceError(traceId, stage, error) {
  console.error(`[VoiceFlow][${traceId || 'system'}] ${stage}`, {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    stack: error?.stack,
  })
}
