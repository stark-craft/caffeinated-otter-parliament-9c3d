import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createQrSession, createSession, getMerchantStatus, getQrSessionStatus, sendChat } from './api.js'
import VideoPlayer from './components/VideoPlayer.jsx'
import CommerceSidebar from './components/CommerceSidebar.jsx'
import QrLoginPanel from './components/quickbite/QrLoginPanel.jsx'
import VoiceOverlay from './components/VoiceOverlay.jsx'
import { MERCHANT_IDS, anyMerchantConnected, verticalUnlocked } from './quickbite/merchantAccess.js'
import { searchPrompt } from './quickbite/searchPrompt.js'
import { sttKeyterms } from './quickbite/keyterms.js'
import { useLiveOrderTracking } from './hooks/useLiveOrderTracking.js'
import { useVoiceKey } from './hooks/useVoiceKey.js'
import { useSamsungVoice } from './hooks/useSamsungVoice.js'
import { findVoiceCommand, getHiddenVoiceTargets } from './quickbite/voiceNavigation.js'
import { buildView } from './quickbite/viewContext.js'
import { deriveIntent } from './quickbite/deriveIntent.js'
import { routeIntent } from './quickbite/intents.js'
import { newVoiceTrace, voiceError, voiceLog, voiceWarn } from './quickbite/voiceDiagnostics.js'
import { paymentQrFromEnvelope, trackingFromEnvelope } from './quickbite/envelopes.js'
import { confirmedCodCheckout, paymentMethodFromEnvelope } from './quickbite/payMode.js'
const samsungVoiceTargets = getHiddenVoiceTargets()
const SamsungVoiceTargetRegistry = memo(function SamsungVoiceTargetRegistry({ transcriptRef }) {
return (
<div className="vp-voice-command-targets" style={{ position: 'fixed', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
{samsungVoiceTargets.map(({ label }) => (
<button key={label} type="button" tabIndex={-1} aria-label={label} onClick={() => transcriptRef.current?.(label, 'en-IN', 'samsung-dom-target')} />
))}
</div>
)
})
export default function App() {
const [sessionId, setSessionId] = useState('')
const [platforms, setPlatforms] = useState([])
const [merchantStatuses, setMerchantStatuses] = useState({})
const [authChecked, setAuthChecked] = useState(false)
const [qrTarget, setQrTarget] = useState(null)
const [qrSessionId, setQrSessionId] = useState('')
const [qrLoading, setQrLoading] = useState(false)
const [qrError, setQrError] = useState('')
const [qrComplete, setQrComplete] = useState(false)
const [qrAttempt, setQrAttempt] = useState(0)
const [messages, setMessages] = useState([])
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)
const [paneOpen, setPaneOpen] = useState(false)
const [peekSidebar, setPeekSidebar] = useState(false)
const [isFullscreen, setIsFullscreen] = useState(false)
const [activeOrder, setActiveOrder] = useState(null)
const [sessionError, setSessionError] = useState('')
const [externalRequest, setExternalRequest] = useState(null)
const [panelState, setPanelState] = useState(null)
const orderSeq = useRef(0)
const requestSeq = useRef(0)
const commerceRef = useRef(null)
const sessionBootRef = useRef(null)
const qrBootRef = useRef(null)
const samsungTranscriptRef = useRef(null)
const hasConnectedMerchant = anyMerchantConnected(merchantStatuses, platforms)
const foodUnlocked = verticalUnlocked(merchantStatuses, platforms, 'food')
const groceryUnlocked = verticalUnlocked(merchantStatuses, platforms, 'grocery')
const qrReady = authChecked
const qrRequired = !qrReady || !hasConnectedMerchant || Boolean(qrTarget) || Boolean(qrSessionId && !qrComplete)
const refreshMerchantStatuses = useCallback(async () => {
const entries = await Promise.all(MERCHANT_IDS.map(async (merchantId) => {
try {
const status = await getMerchantStatus(merchantId)
return [merchantId, status?.connected === true]
} catch {
return [merchantId, null]
}
}))
const next = Object.fromEntries(entries)
setMerchantStatuses(next)
setAuthChecked(true)
return next
}, [])
const refreshCommerceSession = useCallback(async () => {
const response = await createSession(sessionId || localStorage.getItem('ca_sid') || null)
const payload = response?.payload && typeof response.payload === 'object' ? response.payload : response
const id = payload.session_id || payload.id || sessionId
if (id) {
setSessionId(id)
localStorage.setItem('ca_sid', id)
}
const nextPlatforms = payload.platforms || []
setPlatforms(nextPlatforms)
setSessionError('')
return nextPlatforms
}, [sessionId])
const requestQrLogin = useCallback((vertical) => {
setQrTarget(vertical)
setQrSessionId('')
setQrComplete(false)
setQrError('')
setPaneOpen(true)
}, [])
const retryQrLogin = useCallback(() => {
setQrSessionId('')
setQrComplete(false)
setQrError('')
setQrAttempt((attempt) => attempt + 1)
}, [])
const closeQrLogin = useCallback(() => {
if (qrTarget && hasConnectedMerchant) {
setQrTarget(null)
setQrSessionId('')
setQrComplete(false)
} else {
setPaneOpen(false)
}
}, [qrTarget, hasConnectedMerchant])
const seedTracking = useCallback((envelope) => {
const tracking = trackingFromEnvelope(envelope)
if (!tracking) return envelope
const qr = paymentQrFromEnvelope(envelope, { allowImageFallback: !confirmedCodCheckout(envelope) })
const payment = paymentMethodFromEnvelope(envelope)
orderSeq.current += 1
setActiveOrder({ seq: orderSeq.current, tracking, qr, payment })
setPaneOpen(true)
return envelope
}, [])
useEffect(() => {
let cancelled = false
const saved = localStorage.getItem('ca_sid') || null
if (!sessionBootRef.current) sessionBootRef.current = createSession(saved)
sessionBootRef.current
.then((session) => {
if (cancelled) return
const payload = session?.payload && typeof session.payload === 'object' ? session.payload : session
const id = payload.session_id || payload.id || saved || ''
setSessionId(id)
if (id) localStorage.setItem('ca_sid', id)
setPlatforms(payload.platforms || [])
if (payload.tracking) seedTracking(payload)
})
.catch((error) => {
if (!cancelled) {
setSessionError(`Backend unavailable: ${error.message}`)
}
})
return () => { cancelled = true }
}, [seedTracking])
useEffect(() => {
refreshMerchantStatuses()
}, [refreshMerchantStatuses])
useEffect(() => {
if (!paneOpen) return undefined
const interval = setInterval(refreshMerchantStatuses, 15000)
return () => clearInterval(interval)
}, [paneOpen, refreshMerchantStatuses])
useEffect(() => {
if (!paneOpen || !qrReady || !qrRequired || qrSessionId || qrError || qrBootRef.current) return
setQrLoading(true)
const request = createQrSession()
qrBootRef.current = request
request.then((data) => {
if (!data?.session_id) throw new Error('The QR service did not return a session ID.')
setQrSessionId(data.session_id)
}).catch((error) => {
setQrError(error.name === 'AbortError'
? 'QR service did not respond. Check the backend connection.'
: error.message || 'QR service unavailable.')
}).finally(() => {
qrBootRef.current = null
setQrLoading(false)
})
}, [paneOpen, qrReady, qrRequired, qrSessionId, qrError, qrAttempt])
useEffect(() => {
if (!paneOpen || !qrRequired || !qrSessionId) return undefined
let active = true
let inFlight = false
const poll = async () => {
if (inFlight) return
inFlight = true
try {
const status = await getQrSessionStatus(qrSessionId)
if (!active || !status?.login_complete) return
const [nextStatuses, nextPlatforms] = await Promise.all([
refreshMerchantStatuses(),
refreshCommerceSession(),
])
if (!active) return
setQrComplete(true)
const unlocked = qrTarget
? verticalUnlocked(nextStatuses, nextPlatforms, qrTarget)
: anyMerchantConnected(nextStatuses, nextPlatforms)
if (unlocked) {
setQrTarget(null)
setQrSessionId('')
setQrError('')
}
} catch {
// The QR service may be temporarily unreachable; keep the pairing code visible.
} finally {
inFlight = false
}
}
const interval = setInterval(poll, 2000)
return () => {
active = false
clearInterval(interval)
}
}, [paneOpen, qrRequired, qrSessionId, qrTarget, refreshMerchantStatuses, refreshCommerceSession])
const send = useCallback(async (text, { silent = false, voiceTraceId = null } = {}) => {
const message = String(text ?? input).trim()
if (!message) {
if (voiceTraceId) voiceWarn(voiceTraceId, 'Empty /chat message skipped', { text })
return null
}
if (!sessionId) {
if (voiceTraceId) voiceWarn(voiceTraceId, '/chat blocked: commerce session unavailable', { message })
throw new Error('The commerce session is not ready. Check the backend connection.')
}
if (!silent) {
setMessages((current) => [...current, { role: 'user', text: message }])
setInput('')
}
setLoading(true)
setPaneOpen(true)
try {
const view = buildView({ ...(panelState || {}), activeOrder })
if (voiceTraceId) voiceLog(voiceTraceId, 'Frontend → backend /api/chat request (LLM input)', { message, view, silent })
const response = await sendChat(sessionId, message, view)
if (voiceTraceId) voiceLog(voiceTraceId, 'Backend /api/chat response (envelope; not raw internal LLM output)', response)
seedTracking(response)
if (!silent || response?.widget === 'message') {
setMessages((current) => [...current, { role: 'assistant', ...response }])
}
return response
} catch (error) {
if (voiceTraceId) voiceError(voiceTraceId, 'Backend /api/chat request failed', error)
throw error
} finally {
setLoading(false)
}
}, [input, seedTracking, sessionId, activeOrder, panelState])
const sendSilent = useCallback((message) => send(message, { silent: true }), [send])
const updateTrackingDescriptor = useCallback((tracking) => {
setActiveOrder((current) => current ? { ...current, tracking } : current)
}, [])
const trackingState = useLiveOrderTracking({
sessionId,
activeOrder,
onDescriptorChange: updateTrackingDescriptor,
})
function issueRequest(request) {
requestSeq.current += 1
const routed = { ...request, nonce: requestSeq.current }
if (routed.voiceTraceId) voiceLog(routed.voiceTraceId, 'App → QuickBite panel request', routed)
setExternalRequest(routed)
}
/* Quick actions predate the intent router and still emit the four legacy
request types. Adapting them here means the panel has exactly one input
shape, and nothing in quickActions.js has to change. */
function intentFromLegacy(request) {
if (request.type === 'track') {
return { name: 'track_order', confidence: 0.99, slots: {}, alternatives: [] }
}
const query = String(request.label || '')
.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^(Order|Best)\s+/i, '').trim()
return {
name: 'search', confidence: 0.99, alternatives: [],
slots: { query, vertical: 'food' },
error: request.type === 'search-error' ? request.message : undefined,
pending: request.type === 'search-loading',
}
}
async function handleQuickAction(action) {
setPaneOpen(true)
if (!hasConnectedMerchant) return
if (action.action !== 'openLiveOrder' && !foodUnlocked) {
requestQrLogin('food')
return
}
if (action.action === 'openLiveOrder') {
issueRequest({ type: 'intent', intent: intentFromLegacy({ type: 'track' }), envelope: null })
return
}
const pending = intentFromLegacy({ type: 'search-loading', label: action.label })
issueRequest({ type: 'intent', intent: pending, envelope: null })
try {
const envelope = await sendSilent(action.prompt)
issueRequest({ type: 'intent', intent: { ...pending, pending: false }, envelope })
} catch (error) {
issueRequest({
type: 'intent',
intent: intentFromLegacy({ type: 'search-error', label: action.label, message: error.message }),
envelope: null,
})
}
}
const handleTranscript = useCallback(async (transcript, language, source = 'unknown', incomingTraceId = null) => {
const voiceTraceId = incomingTraceId || newVoiceTrace(source)
voiceLog(voiceTraceId, 'CommAgent handleTranscript entered', { transcript, language, source, panelState })
setInput(transcript)
const view = buildView({ ...(panelState || {}), activeOrder })
voiceLog(voiceTraceId, 'Current view snapshot for voice routing', view)
const voiceCommand = findVoiceCommand(transcript)
voiceLog(voiceTraceId, 'Pre-backend navigation label lookup', { matched: Boolean(voiceCommand), command: voiceCommand })
if (voiceCommand) {
  if (!hasConnectedMerchant) {
    voiceWarn(voiceTraceId, 'Voice navigation blocked: merchant login required; opening QR panel', { command: voiceCommand })
    setPaneOpen(true); return
  }
  const requestedVertical = voiceCommand.type.startsWith('grocery') ? 'grocery' : 'food'
  if (voiceCommand.type !== 'home' && voiceCommand.type !== 'track' &&
      !verticalUnlocked(merchantStatuses, platforms, requestedVertical)) {
    voiceWarn(voiceTraceId, 'Voice navigation blocked: vertical locked; opening QR panel', { requestedVertical, command: voiceCommand })
    requestQrLogin(requestedVertical)
    return
  }
  setPaneOpen(true)
  if (voiceCommand.type === 'track') {
    voiceLog(voiceTraceId, 'Matched local track command; no /chat call', { command: voiceCommand })
    issueRequest({ type: 'intent', intent: { name: 'track_order', confidence: 0.99, slots: {}, alternatives: [] }, envelope: null, voiceTraceId })
  } else {
    voiceLog(voiceTraceId, 'Matched local navigation command; no /chat call', { command: voiceCommand })
    issueRequest({ type: 'voice-nav', target: voiceCommand, voiceTraceId })
  }
  return
}
const local = deriveIntent(transcript, { ...view, language }, null)
voiceLog(voiceTraceId, 'Local intent derivation', local)
if (!hasConnectedMerchant) {
voiceWarn(voiceTraceId, 'Voice intent blocked: merchant login required; opening QR panel', { intent: local.name })
setPaneOpen(true)
return
}
const requestedVertical = local.slots?.vertical === 'grocery' ? 'grocery' : 'food'
if ((local.name === 'switch_vertical' || ['search', 'refine', 'compare'].includes(local.name)) &&
!verticalUnlocked(merchantStatuses, platforms, requestedVertical)) {
voiceWarn(voiceTraceId, 'Voice intent blocked: vertical locked; opening QR panel', { requestedVertical, intent: local.name })
requestQrLogin(requestedVertical)
return
}
/* The router, not this function, decides whether a round trip is allowed.
Deciding here meant the request was already in flight before routeIntent
ever ran, so the payment-screen lock, the stale-results guard and the
confidence floor were all bypassed for any utterance that fetched: the
lock raised "Payment in progress. Cancel the order?" and the arriving
envelope then cleared that very strip and navigated away mid-payment. */
const needsBackend = ['search', 'refine', 'compare'].includes(local.name)
const gate = routeIntent(local, view)
voiceLog(voiceTraceId, 'Intent router decision', { intent: local.name, needsBackend, gate })
if (!needsBackend || gate.strip) {
setPaneOpen(true)
voiceLog(voiceTraceId, 'Intent handled locally or held by confirmation strip; no /chat call', { intent: local.name, strip: gate.strip })
issueRequest({ type: 'intent', intent: local, envelope: null, voiceTraceId })
return
}
setPaneOpen(true)
issueRequest({ type: 'intent', intent: { ...local, pending: true }, envelope: null, voiceTraceId })
try {
/* The whole transcript, not the stripped query: the sentence is what the
agent routes on ("order from <restaurant>" must not become a dish
search). searchPrompt only appends which platforms of this vertical
are actually connected. */
const prompt = searchPrompt(transcript, local.slots?.vertical || view.vertical, platforms)
voiceLog(voiceTraceId, 'Voice transcript → backend search prompt', { transcript, prompt, vertical: local.slots?.vertical || view.vertical })
const envelope = await send(prompt, { silent: true, voiceTraceId })
/* `local`, not a re-derive: every envelope-bearing branch in the panel
returns before routeIntent, so the second derivation was dead work —
and it ran against the pre-search view, which is now stale. */
issueRequest({ type: 'intent', intent: { ...local, pending: false }, envelope, voiceTraceId })
} catch (error) {
voiceError(voiceTraceId, 'Voice backend/search routing failed', error)
issueRequest({ type: 'intent', intent: { ...local, error: error.message }, envelope: null, voiceTraceId })
}
}, [activeOrder, panelState, platforms, merchantStatuses, hasConnectedMerchant, requestQrLogin, send])
samsungTranscriptRef.current = handleTranscript
/* "Try again" on the confirmation strip. The panel hands back the request
that failed; a request that carried a query re-runs the network call,
anything else is simply re-issued with a fresh nonce so the panel routes
it again. Without the fresh nonce the panel's effect would not re-fire. */
const handleRetryRequest = useCallback(async (request) => {
const intent = request?.intent
if (!intent) return
const voiceTraceId = request.voiceTraceId || null
if (voiceTraceId) voiceLog(voiceTraceId, 'Retrying voice-originated panel request', { intent })
const query = String(intent.slots?.query || '').trim()
setPaneOpen(true)
if (!query) {
issueRequest({ type: 'intent', intent: { ...intent, error: undefined }, envelope: null, voiceTraceId })
return
}
const base = { ...intent, error: undefined }
issueRequest({ type: 'intent', intent: { ...base, pending: true }, envelope: null, voiceTraceId })
try {
/* Through searchPrompt, like the first attempt. Sending the bare query
reproduced the very bug that module exists to fix: no platform named,
so only one of them was searched. */
const envelope = await send(
searchPrompt(query, intent.slots?.vertical, platforms),
{ silent: true, voiceTraceId },
)
issueRequest({ type: 'intent', intent: { ...base, pending: false }, envelope, voiceTraceId })
} catch (error) {
if (voiceTraceId) voiceError(voiceTraceId, 'Retry of voice-originated request failed', error)
issueRequest({
type: 'intent',
intent: { ...base, pending: false, error: error.message },
envelope: null,
voiceTraceId,
})
}
}, [platforms, send])
/* Recomputed per utterance rather than captured once: the strongest terms
are the ones currently on screen, and that changes with every screen. */
const getKeyterms = useCallback(
() => sttKeyterms(buildView({ ...(panelState || {}), activeOrder })),
[panelState, activeOrder],
)
/* Opt-in only: without a microphone the hold-to-talk key reports that it
could not listen, rather than submitting a canned line the user never
said. `?demo=1` restores the scripted utterances for a mic-less demo. */
const demoVoice = new URLSearchParams(window.location.search).has('demo')
const voice = useVoiceKey({
onTranscript: handleTranscript,
disabled: !sessionId,
getKeyterms,
demoVoice,
})
const samsungVoice = useSamsungVoice({ onTranscript: handleTranscript })
const visibleVoice = samsungVoice.phase !== 'idle' || samsungVoice.micError ? samsungVoice : voice
const commerceOverlay = qrRequired ? (
<QrLoginPanel
ref={commerceRef}
open={paneOpen}
onClose={closeQrLogin}
onRetry={retryQrLogin}
sessionId={qrSessionId}
loading={qrLoading}
error={qrError}
connectionError={sessionError}
complete={qrComplete}
ready={qrReady}
target={qrTarget}
/>
) : (
<CommerceSidebar
ref={commerceRef}
open={paneOpen}
onClose={() => setPaneOpen(false)}
sessionId={sessionId}
activeOrder={activeOrder}
onClearActiveOrder={() => setActiveOrder(null)}
platforms={platforms}
sendSilent={sendSilent}
merchantAccess={{ food: foodUnlocked, grocery: groceryUnlocked }}
onRequestLogin={requestQrLogin}
externalRequest={externalRequest}
trackingState={trackingState}
onPanelState={setPanelState}
onRetryRequest={handleRetryRequest}
/>
)
return (
<div className={`app-shell ${isFullscreen ? 'is-fullscreen' : ''}`}>
<main className="app-main" onMouseEnter={() => setPeekSidebar(true)} onMouseLeave={() => setPeekSidebar(false)} data-peek={peekSidebar || undefined}>
<VideoPlayer
paneOpen={paneOpen}
onOpenShop={() => setPaneOpen(true)}
onCloseShop={() => setPaneOpen(false)}
onQuickAction={handleQuickAction}
commerceOverlay={commerceOverlay}
commerceRef={commerceRef}
onFullscreenChange={setIsFullscreen}
/>
</main>
{window.tizen && <SamsungVoiceTargetRegistry transcriptRef={samsungTranscriptRef} />}
<VoiceOverlay
phase={visibleVoice.phase}
transcript={visibleVoice.transcript}
scripted={voice.scripted}
micError={visibleVoice.micError}
/>
</div>
)}
