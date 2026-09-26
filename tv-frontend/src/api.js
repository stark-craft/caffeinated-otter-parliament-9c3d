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

async function post(path, body, timeoutMs) {
  const controller = timeoutMs ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const r = await fetch(
      apiUrl(path),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        ...(controller ? { signal: controller.signal } : {}),
      },
    )

    if (!r.ok) {
      throw new Error(
        `${path} -> HTTP ${r.status}`,
      )
    }

    return r.json()
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function get(path) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const r = await fetch(apiUrl(path), { signal: controller.signal })
    if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`)
    return r.json()
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

  const r = await fetch(
    apiUrl('/stt'),
    {
      method: 'POST',
      body: form,
    },
  )

  if (!r.ok) {
    throw new Error(
      `/stt -> HTTP ${r.status}`,
    )
  }

  return r.json()
}
