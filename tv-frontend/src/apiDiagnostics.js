import { safeVoiceDetails } from './quickbite/voiceDiagnostics.js'
let requestSequence = 0

function routePath(url) {
  try {
    return new URL(url, 'http://localhost').pathname
  } catch {
    return String(url || '')
  }
}

export function apiPurpose(method, url) {
  const path = routePath(url)
  if (method === 'POST' && path.endsWith('/api/qr/session')) return 'Create the phone-login QR session'
  if (/\/api\/qr\/session\/[^/]+\/status$/.test(path)) return 'Check whether phone login is complete'
  if (/\/api\/qr\/session\/[^/]+\/validate$/.test(path)) return 'Validate the QR session on the phone'
  if (/\/api\/qr\/session\/[^/]+\/complete$/.test(path)) return 'Tell the TV that phone setup is complete'
  if (/\/api\/qr\/auth\/status\/[^/]+$/.test(path)) return 'Check whether a merchant is connected'
  if (path.endsWith('/api/qr/auth/begin')) return 'Start merchant login on the phone'
  if (path.endsWith('/api/qr/auth/complete')) return 'Complete merchant login on the phone'
  if (path.endsWith('/api/qr/user/profile')) return method === 'POST' ? 'Save the phone user profile' : 'Load the phone user profile'
  if (path.endsWith('/api/session')) return 'Create or restore the TV commerce session'
  if (path.endsWith('/api/chat')) return 'Send commerce text to the backend and receive the UI envelope'
  if (path.endsWith('/api/stt')) return 'Transcribe recorded browser speech'
  if (path.endsWith('/api/track')) return 'Get order status, ETA, and payment updates'
  if (path.endsWith('/api/addresses')) return 'Load saved delivery addresses'
  if (path.endsWith('/api/address')) return 'Select a delivery address'
  if (path.endsWith('/api/auth/begin')) return 'Start merchant authorization'
  if (path.endsWith('/api/auth/complete')) return 'Complete merchant authorization'
  if (path.endsWith('/api/llm')) return 'Select the backend language model'
  return 'Call backend endpoint'
}

export function apiResponseMismatch(method, url, data) {
  const path = routePath(url)
  if (method === 'POST' && path.endsWith('/api/qr/session') && !data?.session_id) {
    return 'Expected a non-empty session_id; the TV cannot draw a login QR without it.'
  }
  if (/\/api\/qr\/session\/[^/]+\/status$/.test(path) && typeof data?.login_complete !== 'boolean') {
    return 'Expected a boolean login_complete; the TV cannot determine whether phone login finished.'
  }
  if (/\/api\/qr\/session\/[^/]+\/validate$/.test(path) && typeof data?.valid !== 'boolean') {
    return 'Expected a boolean valid; the phone cannot validate the scanned QR session.'
  }
  if (/\/api\/qr\/auth\/status\/[^/]+$/.test(path) && typeof data?.connected !== 'boolean') {
    return 'Expected a boolean connected; the UI cannot determine merchant login state.'
  }
  if (path.endsWith('/api/qr/auth/begin')) {
    if (typeof data?.status !== 'string') return 'Expected a status string from merchant login.'
    if (data.status === 'pending' && !data.auth_url) return 'Login is pending, but auth_url is missing; the phone has no merchant login page to open.'
  }
  if (method === 'POST' && path.endsWith('/api/session')) {
    const payload = data?.payload && typeof data.payload === 'object' ? data.payload : data
    if (!payload?.session_id && !payload?.id) return 'Expected session_id or id; the TV can only continue if it already has a saved session.'
  }
  if (path.endsWith('/api/stt') && !data?.transcript && !data?.error) {
    return 'Expected a transcript or an error from speech transcription.'
  }
  return ''
}

function tag(trace) {
  return `[CommAgent Backend][${trace.surface} #${trace.id}]`
}

export function logApiRequest(surface, method, url, body, details = {}) {
  let fullUrl = url
  try {
    if (typeof window !== 'undefined') fullUrl = new URL(url, window.location.href).href
  } catch { /* Keep the original URL so a malformed address is still visible. */ }
  const trace = {
    id: ++requestSequence,
    surface,
    method,
    url: fullUrl,
    purpose: apiPurpose(method, fullUrl),
    startedAt: Date.now(),
  }
  console.log(`${tag(trace)} REQUEST — ${trace.purpose}`, safeVoiceDetails({
    method,
    url: fullUrl,
    body: body ?? null,
    ...details,
    expected: 'HTTP 2xx with a JSON response',
  }))
  return trace
}

export function logApiResponse(trace, status, data) {
  console.log(`${tag(trace)} RESPONSE — ${trace.purpose}`, safeVoiceDetails({
    method: trace.method,
    url: trace.url,
    status,
    elapsedMs: Date.now() - trace.startedAt,
    data,
  }))
  const mismatch = apiResponseMismatch(trace.method, trace.url, data)
  if (mismatch) {
    console.warn(`${tag(trace)} RESPONSE MISMATCH — ${mismatch}`, safeVoiceDetails({
      url: trace.url,
      actualResponse: data,
    }))
  }
}

function failureHint(status, error) {
  if (status >= 200 && status < 300 && error instanceof SyntaxError) return 'The endpoint responded, but its body was not valid JSON.'
  if (status === 404) return 'Endpoint not found. Check the URL and backend route.'
  if (status === 401 || status === 403) return 'Authentication or permission was rejected.'
  if (status >= 500) return 'The backend returned a server error.'
  if (error?.name === 'AbortError' || error?.code === 'ECONNABORTED') return 'The request timed out or was cancelled.'
  if (!status) return 'No HTTP response. Check server availability, network access, and CORS.'
  return 'The backend rejected this request.'
}

export function logApiFailure(trace, { status = null, responseBody = null, error = null } = {}) {
  console.error(`${tag(trace)} FAILED — ${trace.purpose}`, safeVoiceDetails({
    method: trace.method,
    url: trace.url,
    expected: 'HTTP 2xx with a JSON response',
    actual: status ? `HTTP ${status}${error ? ` — ${error.message}` : ''}` : error?.message || 'No HTTP response',
    possibleCause: failureHint(status, error),
    elapsedMs: Date.now() - trace.startedAt,
    backendResponse: responseBody,
    error,
  }))
}
