import { logApiFailure, logApiRequest, logApiResponse } from './apiDiagnostics.js'

const BACKEND_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '')

function apiUrl(path) {
  /*
   * Development:
   *
   *   VITE_API_BASE_URL is empty
   *   -> /api/session
   *   -> Vite dev proxy handles it
   *
   * TV / production:
   *
   *   VITE_API_BASE_URL=http://192.168.x.x:8077
   *   -> http://192.168.x.x:8077/api/session
   */
  return `${BACKEND_ORIGIN}/api${path}`
}

async function backendErrorBody(response) {
  try {
    const text = await response.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return text }
  } catch (error) {
    return `Could not read backend error body: ${error.message}`
  }
}

async function post(path, body, timeoutMs) {
  const controller = timeoutMs ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  const url = apiUrl(path)
  const trace = logApiRequest('TV', 'POST', url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: timeoutMs || null,
  })
  let failureLogged = false
  let responseStatus = null
  try {
    const r = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        ...(controller ? { signal: controller.signal } : {}),
      },
    )
    responseStatus = r.status

    if (!r.ok) {
      logApiFailure(trace, { status: r.status, responseBody: await backendErrorBody(r) })
      failureLogged = true
      throw new Error(
        `${path} -> HTTP ${r.status}`,
      )
    }

    const data = await r.json()
    logApiResponse(trace, r.status, data)
    return data
  } catch (error) {
    if (!failureLogged) logApiFailure(trace, { status: responseStatus, error })
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function get(path) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const url = apiUrl(path)
  const trace = logApiRequest('TV', 'GET', url, null, { timeoutMs: 8000 })
  let failureLogged = false
  let responseStatus = null
  try {
    const r = await fetch(url, { signal: controller.signal })
    responseStatus = r.status
    if (!r.ok) {
      logApiFailure(trace, { status: r.status, responseBody: await backendErrorBody(r) })
      failureLogged = true
      throw new Error(`${path} -> HTTP ${r.status}`)
    }
    const data = await r.json()
    logApiResponse(trace, r.status, data)
    return data
  } catch (error) {
    if (!failureLogged) logApiFailure(trace, { status: responseStatus, error })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const createQrSession = () => post('/qr/session', {}, 8000)

export const getQrSessionStatus = (sessionId) =>
  get(`/qr/session/${encodeURIComponent(sessionId)}/status`)

export const getMerchantStatus = (merchantId) =>
  get(`/qr/auth/status/${encodeURIComponent(merchantId)}`)

/*
 * `device` picks the agent's payment branch. This app never sent one, so the
 * backend's device_note() returned "" and the agent got no payment guidance at
 * all on the TV — it was free to reach for scan-to-pay flows this surface
 * cannot render. It is always 'tv' here; unlike the desktop app there is
 * nothing to detect.
 */
export const createSession = (
  session_id,
) =>
  post('/session', {
    session_id,
    device: 'tv',
  })

export const sendChat = (
  session_id,
  message,
  view,
) =>
  post('/chat', view ? { session_id, message, view } : { session_id, message })

export const authBegin = (
  session_id,
  group,
) =>
  post('/auth/begin', {
    session_id,
    group,
  })

export const authComplete = (
  session_id,
  group,
  code,
) =>
  post('/auth/complete', {
    session_id,
    group,
    code,
  })

export const setLlm = (
  session_id,
  name,
) =>
  post('/llm', {
    session_id,
    name,
  })

export const track = (
  session_id,
  tracking,
) =>
  post('/track', {
    session_id,
    tracking,
  })

export const listAddresses = (
  session_id,
) =>
  post('/addresses', {
    session_id,
  })

export const setAddress = (
  session_id,
  address_id,
  label,
) =>
  post('/address', {
    session_id,
    address_id,
    label,
  })

export async function sttTranscribe(
  blob,
  keyterms = [],
) {
  const subtype = (
    blob.type.split('/')[1] ||
    'webm'
  )
    .split(';')[0]

  const form =
    new FormData()

  form.append(
    'file',
    blob,
    `voice.${subtype}`,
  )

  /* Words the app already knows — what is on screen plus its own catalogue.
     Sarvam biases transcription toward them, which is what stops "Chole
     Bhature" coming back as "Motor Chole Bhature". Omitted when empty so the
     backend sends no keyterms field at all. */
  if (
    Array.isArray(keyterms) &&
    keyterms.length
  ) {
    form.append(
      'keyterms',
      JSON.stringify(
        keyterms,
      ),
    )
  }

  const url = apiUrl('/stt')
  const trace = logApiRequest('TV', 'POST', url, {
    formData: form,
    file: { name: `voice.${subtype}`, type: blob.type, size: blob.size },
    keyterms,
  }, {
    contentType: 'multipart/form-data (boundary set by the browser)',
  })
  let failureLogged = false
  let responseStatus = null
  try {
    const r = await fetch(
      url,
      {
        method: 'POST',
        body: form,
      },
    )
    responseStatus = r.status

    if (!r.ok) {
      logApiFailure(trace, { status: r.status, responseBody: await backendErrorBody(r) })
      failureLogged = true
      throw new Error(`/stt -> HTTP ${r.status}`)
    }

    const data = await r.json()
    logApiResponse(trace, r.status, data)
    return data
  } catch (error) {
    if (!failureLogged) logApiFailure(trace, { status: responseStatus, error })
    throw error
  }
}
