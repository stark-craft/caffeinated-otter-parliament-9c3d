import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createQrSession, createSession, getMerchantStatus, getQrSessionStatus, sendChat } from './api.js'
import VideoPlayer from './universalGuide/UniversalGuidePlayer.jsx'
import { useProductShortcut } from './universalGuide/useProductShortcut.js'
import { useLoginContinuation, withGroceryPurchaseContext } from './universalGuide/useLoginContinuation.js'
import CommerceSidebar from './components/CommerceSidebar.jsx'
import QrLoginPanel from './components/quickbite/QrLoginPanel.jsx'
import VoiceOverlay from './components/VoiceOverlay.jsx'
import { MERCHANT_IDS, anyMerchantConnected, verticalUnlocked, merchantConnected, effectivePlatforms, mergeMerchantStatuses } from './quickbite/merchantAccess.js'
import { searchPrompt } from './quickbite/searchPrompt.js'
import { PROVIDERS, requestedProviders, providerResponseProblem } from './quickbite/providers.js'
import { commerceLog, responseAttribution } from './quickbite/commerceDiagnostics.js'
import { sttKeyterms } from './quickbite/keyterms.js'
import { useLiveOrderTracking } from './hooks/useLiveOrderTracking.js'
import { useVoiceKey } from './hooks/useVoiceKey.js'
import { useSamsungVoice } from './hooks/useSamsungVoice.js'
import { findVoiceCommand, getHiddenVoiceTargets } from './quickbite/voiceNavigation.js'
import { buildView, viewForRequest } from './quickbite/viewContext.js'
import { deriveIntent } from './quickbite/deriveIntent.js'
import { routeIntent } from './quickbite/intents.js'
import { newVoiceTrace, voiceError, voiceLog, voiceWarn } from './quickbite/voiceDiagnostics.js'
import { cartFromEnvelope, paymentQrFromEnvelope, trackingFromEnvelope } from './quickbite/envelopes.js'
import { confirmedCodCheckout, paymentMethodFromEnvelope } from './quickbite/payMode.js'
import { orderPlacedLine, setSpeechEnabled, speak, trackingAnnouncement } from './quickbite/speech.js'
import { trackingPhase, trackingPhaseRank } from './quickbite/tracking.js'
import { searchBannerPlan } from './universalGuide/searchBanners.js'
/* Speech is opt-in and retains the frontend team's TV voice diagnostics. */
function say(text, { lang = 'en-IN', traceId = null, reason = '' } = {}) {
  return speak(text, { lang, log: (outcome, detail) => voiceLog(traceId, `TTS ${outcome}${reason ? ` (${reason})` : ''}`, detail) })
}
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
const [qrProvider, setQrProvider] = useState(null)
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
const continuationResumeRef = useRef(null)
const merchantStatusesRef = useRef({})
const merchantPollRef = useRef(null)
const discoverySeqRef = useRef(0)
const hasConnectedMerchant = anyMerchantConnected(merchantStatuses, platforms)
const foodUnlocked = verticalUnlocked(merchantStatuses, platforms, 'food')
const groceryUnlocked = verticalUnlocked(merchantStatuses, platforms, 'grocery')
const qrReady = authChecked
const qrRequired = !qrReady || (!hasConnectedMerchant && !activeOrder && !externalRequest) || Boolean(qrTarget) || Boolean(qrSessionId && !qrComplete)
const loginContinuation = useLoginContinuation({
paneOpen,
ready: action => !qrRequired && Boolean(sessionId) && (action.provider
  ? merchantConnected(merchantStatuses, platforms, PROVIDERS[action.provider].merchant)
  : action.vertical ? verticalUnlocked(merchantStatuses, platforms, action.vertical) : hasConnectedMerchant),
onResume: action => continuationResumeRef.current?.(action),
})
const refreshMerchantStatuses = useCallback(async () => {
if (merchantPollRef.current) return merchantPollRef.current
const poll = (async () => {
const entries = await Promise.all(MERCHANT_IDS.map(async (merchantId) => {
try {
const status = await getMerchantStatus(merchantId)
return [merchantId, typeof status?.connected === 'boolean' ? status.connected : null]
} catch {
return [merchantId, null]
}
}))
const observed = Object.fromEntries(entries)
const next = mergeMerchantStatuses(merchantStatusesRef.current, observed)
merchantStatusesRef.current = next
setMerchantStatuses(next)
setAuthChecked(true)
commerceLog('merchant-status', { observed, retained: next })
return next
})()
merchantPollRef.current = poll
try { return await poll } finally { merchantPollRef.current = null }
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
const requestQrLogin = useCallback((vertical, provider = null) => {
setQrTarget(vertical)
setQrProvider(provider)
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
loginContinuation.clear()
if (qrTarget && (hasConnectedMerchant || externalRequest || activeOrder)) {
setQrTarget(null)
setQrProvider(null)
setQrSessionId('')
setQrComplete(false)
} else {
setPaneOpen(false)
}
}, [qrTarget, hasConnectedMerchant, externalRequest, activeOrder, loginContinuation.clear])
const seedTracking = useCallback((envelope) => {
const tracking = trackingFromEnvelope(envelope)
if (!tracking) return envelope
const qr = paymentQrFromEnvelope(envelope, { allowImageFallback: !confirmedCodCheckout(envelope) })
const payment = paymentMethodFromEnvelope(envelope)
orderSeq.current += 1
setActiveOrder({ seq: orderSeq.current, tracking, qr, payment })
if (announce) say(orderPlacedLine({ qr, payment, amount: cartFromEnvelope(envelope)?.total }), { reason: 'order placed' })
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
refreshMerchantStatuses()
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
const unlocked = qrProvider
? merchantConnected(nextStatuses, nextPlatforms, PROVIDERS[qrProvider].merchant)
: qrTarget
? verticalUnlocked(nextStatuses, nextPlatforms, qrTarget)
: anyMerchantConnected(nextStatuses, nextPlatforms)
if (unlocked) {
setQrTarget(null)
setQrProvider(null)
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
}, [paneOpen, qrRequired, qrSessionId, qrTarget, qrProvider, refreshMerchantStatuses, refreshCommerceSession])
const send = useCallback(async (text, { silent = false, voiceTraceId = null, searchIntent = null, searchVertical = null, provider = null, lang = 'en-IN', fresh = false } = {}) => {
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
let sequence = null
let orderEvidence = false
try {
const currentView = buildView({ ...(panelState || {}), activeOrder })
const derived = searchVertical ? deriveIntent(message, { ...currentView, vertical: searchVertical }) : null
const intent = searchIntent || (derived ? { ...derived, name: 'search', journey: 'new-search', slots: { ...derived.slots, vertical: searchVertical } } : null)
// Check the actual named merchant before any backend request, even when another
// food/grocery merchant is connected. This also covers panel widget/cart actions.
const intendedProviders = [...new Set([
  ...requestedProviders(message),
  ...(intent?.slots?.providers || []),
  ...(provider ? [provider] : []),
])].filter(id => Boolean(PROVIDERS[id]))
const missing = intendedProviders.find(id =>
  !merchantConnected(merchantStatusesRef.current, platforms, PROVIDERS[id].merchant))
if (missing) {
  requestQrLogin(PROVIDERS[missing].vertical, missing)
  const error = new Error(`Connect ${PROVIDERS[missing].label} using the login QR to continue.`)
  error.kind = 'provider-login-required'
  error.provider = missing
  throw error
}
sequence = intent ? ++discoverySeqRef.current : null
const view = intent ? viewForRequest(currentView, intent) : currentView
const scope = effectivePlatforms(merchantStatusesRef.current, platforms)
const outbound = intent ? searchPrompt(message, intent.slots?.vertical, scope) : message
const expected = { slots: { providers: intendedProviders } }
commerceLog('request', { userSaid: message, intent, currentView, request: { session_id: sessionId, message: outbound, view }, merchantStatuses: merchantStatusesRef.current, sessionPlatforms: platforms, effectiveScope: scope, expectedProviders: expected.slots?.providers })
if (voiceTraceId) voiceLog(voiceTraceId, 'Frontend → backend /api/chat request (LLM input)', { message: outbound, view, silent })
const response = await sendChat(sessionId, outbound, view, { fresh })
if (voiceTraceId) voiceLog(voiceTraceId, 'Backend /api/chat response (envelope; not raw internal LLM output)', response)
commerceLog('response', { expectedProviders: expected.slots?.providers, ...responseAttribution(response) })
// Preserve real order evidence even if an unexpected provider or an older
// search produced it. Never replay checkout to reconcile that response.
seedTracking(response)
orderEvidence = Boolean(trackingFromEnvelope(response))
if (sequence !== null && sequence !== discoverySeqRef.current && !orderEvidence) {
commerceLog('superseded-response', { sequence, latest: discoverySeqRef.current, ...responseAttribution(response) })
const error = new Error('A newer search replaced this response.')
error.kind = 'superseded-search'
throw error
}
const problem = providerResponseProblem(expected, response)
if (problem) {
  commerceLog('provider-error', problem)
  if (problem.kind === 'provider-unavailable' && problem.provider && PROVIDERS[problem.provider]) {
    // An alternative-store backend response is not a login method.
    requestQrLogin(PROVIDERS[problem.provider].vertical, problem.provider)
  }
  const error = new Error(problem.message)
  Object.assign(error, problem)
  throw error
}
/* Speak only a voice-originated response; order confirmation is announced
   separately by seedTracking, and remote button presses remain silent. */
if (voiceTraceId && !trackingFromEnvelope(response)) {
  say(response?.text || response?.payload?.title, { lang, traceId: voiceTraceId, reason: 'voice reply' })
}
if (!silent || response?.widget === 'message') {
setMessages((current) => [...current, { role: 'assistant', ...response }])
}
return response
} catch (error) {
if (sequence !== null && sequence !== discoverySeqRef.current && !orderEvidence && error.kind !== 'superseded-search') {
commerceLog('superseded-error', { sequence, latest: discoverySeqRef.current })
error.kind = 'superseded-search'
}
if (voiceTraceId) voiceError(voiceTraceId, 'Backend /api/chat request failed', error)
throw error
} finally {
if (sequence === null || sequence === discoverySeqRef.current) setLoading(false)
}
}, [input, seedTracking, sessionId, activeOrder, panelState, platforms, requestQrLogin])
const sendSilent = useCallback((message, options = {}) => send(message, { ...options, silent: true }), [send])
const updateTrackingDescriptor = useCallback((tracking) => {
setActiveOrder((current) => current ? { ...current, tracking } : current)
}, [])
/* Announce transitions once. The first snapshot is a baseline rather than an
   interruption of the freshly-placed order announcement. */
const spokenPhaseRef = useRef(null)
const announceTracking = useCallback((snapshot, seq) => {
  if (!snapshot || !seq) return
  const phase = trackingPhase(snapshot)
  const { next, line } = trackingAnnouncement(spokenPhaseRef.current,
    { seq, phase, rank: trackingPhaseRank(phase) })
  spokenPhaseRef.current = next
  if (line) say(line, { reason: `tracking ${phase}` })
}, [])
const trackingState = useLiveOrderTracking({
sessionId,
activeOrder,
onDescriptorChange: updateTrackingDescriptor,
})
useEffect(() => {
  announceTracking(trackingState.snapshot, activeOrder?.seq)
}, [trackingState.snapshot, activeOrder?.seq, announceTracking])
function issueRequest(request) {
requestSeq.current += 1
const routed = { ...request, nonce: requestSeq.current }
if (routed.voiceTraceId) voiceLog(routed.voiceTraceId, 'App → QuickBite panel request', routed)
setExternalRequest(routed)
}
const selectGroceryShortcut = useProductShortcut({
  groceryUnlocked, paneOpen, pairingActive: qrTarget === 'grocery',
  onNavigate: issueRequest, onRequestLogin: requestQrLogin,
  onOpen: () => setPaneOpen(true),
  loginContinuation,
})
/* Preserve the October 14 search-banner flow provided from Windows. */
function selectHomeProduct(id) {
  const plan = searchBannerPlan(id, merchant => merchantConnected(merchantStatuses, platforms, merchant))
  if (!plan) { selectGroceryShortcut(id); return }
  loginContinuation.clear()
  if (plan.login) {
    loginContinuation.remember({ kind: 'search-banner', id, vertical: plan.vertical, provider: plan.provider })
    requestQrLogin(plan.vertical, plan.provider)
    return
  }
  runSearchBanner(plan)
}
async function runSearchBanner(plan) {
  setPaneOpen(true)
  const pending = { name: 'search', confidence: 0.99, alternatives: [], journey: 'new-search',
    slots: { query: plan.label, vertical: plan.vertical }, pending: true }
  issueRequest({ type: 'intent', intent: pending, envelope: null })
  try {
    const envelope = await sendSilent(plan.prompt, { searchVertical: plan.vertical, fresh: true })
    issueRequest({ type: 'intent', intent: { ...pending, pending: false }, envelope })
  } catch (error) {
    if (error.kind === 'superseded-search') return
    issueRequest({ type: 'intent', intent: { ...pending, pending: false, error: error.message }, envelope: null })
  }
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
journey: 'new-search',
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
const envelope = await sendSilent(action.prompt, { searchVertical: 'food' })
issueRequest({ type: 'intent', intent: { ...pending, pending: false }, envelope })
} catch (error) {
issueRequest({
type: 'intent',
intent: intentFromLegacy({ type: 'search-error', label: action.label, message: error.message }),
envelope: null,
})
}
}
const handleTranscript = useCallback(async (transcript, language, source = 'unknown', incomingTraceId = null, resumeView = null) => {
const voiceTraceId = incomingTraceId || newVoiceTrace(source)
loginContinuation.clear()
voiceLog(voiceTraceId, 'CommAgent handleTranscript entered', { transcript, language, source, panelState })
setInput(transcript)
const view = resumeView || buildView({ ...(panelState || {}), activeOrder })
const deferVoice = (vertical, provider = null) => {
  loginContinuation.remember({ kind: 'voice', transcript, language, source, voiceTraceId, view, vertical, provider })
  requestQrLogin(vertical, provider)
}
voiceLog(voiceTraceId, 'Current view snapshot for voice routing', view)
const voiceCommand = findVoiceCommand(transcript)
// Speech controls are available without merchant pairing.
if (voiceCommand?.type === 'speech') {
  voiceLog(voiceTraceId, 'Voice replies toggled', { on: voiceCommand.on })
  setSpeechEnabled(voiceCommand.on)
  if (voiceCommand.on) say('Voice replies are on.', { lang: language, traceId: voiceTraceId, reason: 'unmute' })
  return
}
voiceLog(voiceTraceId, 'Pre-backend navigation label lookup', { matched: Boolean(voiceCommand), command: voiceCommand })
if (voiceCommand) {
  const requestedVertical = ['home', 'track'].includes(voiceCommand.type) ? null
    : voiceCommand.type.startsWith('grocery') ? 'grocery' : 'food'
  if (!hasConnectedMerchant) {
    voiceWarn(voiceTraceId, 'Voice navigation blocked: merchant login required; opening QR panel', { command: voiceCommand })
    deferVoice(requestedVertical); return
  }
  if (voiceCommand.type !== 'home' && voiceCommand.type !== 'track' &&
      !verticalUnlocked(merchantStatuses, platforms, requestedVertical)) {
    voiceWarn(voiceTraceId, 'Voice navigation blocked: vertical locked; opening QR panel', { requestedVertical, command: voiceCommand })
    deferVoice(requestedVertical)
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
const local = withGroceryPurchaseContext(transcript, deriveIntent(transcript, { ...view, language }, null))
voiceLog(voiceTraceId, 'Local intent derivation', local)
// Parse the original utterance as well: not every intent name has providers
// in its slots (notably local navigation and cart-related commands).
const spokenProviders = [...new Set([
  ...requestedProviders(transcript), ...(local.slots?.providers || []),
])]
const explicitProvider = spokenProviders.length > 0
const requestedVertical = local.slots?.vertical === 'grocery' ? 'grocery' : 'food'
const missingProvider = spokenProviders.find(id => PROVIDERS[id] &&
  !merchantConnected(merchantStatuses, platforms, PROVIDERS[id].merchant))
if (missingProvider) {
deferVoice(PROVIDERS[missingProvider].vertical, missingProvider)
return
}
if (!hasConnectedMerchant) {
voiceWarn(voiceTraceId, 'Voice intent blocked: merchant login required; opening QR panel', { intent: local.name })
deferVoice(requestedVertical)
return
}
if (!explicitProvider && (local.name === 'switch_vertical' || ['search', 'refine', 'compare'].includes(local.name)) &&
!verticalUnlocked(merchantStatuses, platforms, requestedVertical)) {
voiceWarn(voiceTraceId, 'Voice intent blocked: vertical locked; opening QR panel', { requestedVertical, intent: local.name })
deferVoice(requestedVertical)
return
}
/* The router, not this function, decides whether a round trip is allowed.
Deciding here meant the request was already in flight before routeIntent
ever ran, so the payment-screen lock, the stale-results guard and the
confidence floor were all bypassed for any utterance that fetched: the
lock raised "Payment in progress. Cancel the order?" and the arriving
envelope then cleared that very strip and navigated away mid-payment. */
const needsBackend = ['search', 'refine', 'compare'].includes(local.name)
const cartMutation = ['remove_item', 'change_qty'].includes(local.name) && !view.cartEditable
const gate = routeIntent(local, view)
voiceLog(voiceTraceId, 'Intent router decision', { intent: local.name, needsBackend, cartMutation, gate })
if (!(needsBackend || cartMutation) || gate.strip) {
setPaneOpen(true)
voiceLog(voiceTraceId, 'Intent handled locally or held by confirmation strip; no /chat call', { intent: local.name, strip: gate.strip })
issueRequest({ type: 'intent', intent: local, envelope: null, voiceTraceId })
return
}
setPaneOpen(true)
issueRequest({ type: 'intent', intent: { ...local, pending: true }, envelope: null, voiceTraceId, utterance: transcript })
try {
/* The whole transcript, not the stripped query: the sentence is what the
agent routes on ("order from <restaurant>" must not become a dish
search). searchPrompt only appends which platforms of this vertical
are actually connected. */
const envelope = await send(transcript, { silent: true, voiceTraceId, searchIntent: local })
/* `local`, not a re-derive: every envelope-bearing branch in the panel
returns before routeIntent, so the second derivation was dead work —
and it ran against the pre-search view, which is now stale. */
issueRequest({ type: 'intent', intent: { ...local, pending: false }, envelope, voiceTraceId, utterance: transcript })
} catch (error) {
if (error.kind === 'superseded-search') return
if (['provider-login-required', 'provider-unavailable'].includes(error.kind) && PROVIDERS[error.provider]) {
  // Resume only the discovery request once the *specific* merchant connects.
  // Never automatically replay payment, cart mutations or checkout.
  if (needsBackend) {
    deferVoice(PROVIDERS[error.provider].vertical, error.provider)
  } else {
    requestQrLogin(PROVIDERS[error.provider].vertical, error.provider)
  }
  return
}
voiceError(voiceTraceId, 'Voice backend/search routing failed', error)
issueRequest({ type: 'intent', intent: { ...local, pending: false, error: error.message, reconnectProvider: error.provider || local.slots?.provider }, envelope: null, voiceTraceId, utterance: transcript })
}
}, [activeOrder, panelState, platforms, merchantStatuses, hasConnectedMerchant, requestQrLogin, send, loginContinuation.clear, loginContinuation.remember])
samsungTranscriptRef.current = handleTranscript
continuationResumeRef.current = action => {
  if (action.kind === 'banner') issueRequest(action.request)
  else if (action.kind === 'search-banner') selectHomeProduct(action.id)
  else if (action.kind === 'voice') {
    handleTranscript(action.transcript, action.language, action.source, action.voiceTraceId, action.view)
  }
}
/* "Try again" on the confirmation strip. The panel hands back the request
that failed; a request that carried a query re-runs the network call,
anything else is simply re-issued with a fresh nonce so the panel routes
it again. Without the fresh nonce the panel's effect would not re-fire. */
const handleRetryRequest = useCallback(async (request) => {
const intent = request?.intent
if (!intent) return
const voiceTraceId = request.voiceTraceId || null
if (voiceTraceId) voiceLog(voiceTraceId, 'Retrying voice-originated panel request', { intent })
const query = String(request.utterance || intent.transcript || intent.slots?.query || '').trim()
setPaneOpen(true)
if (!query) {
issueRequest({ type: 'intent', intent: { ...intent, error: undefined }, envelope: null, voiceTraceId })
return
}
const base = { ...intent, error: undefined, reconnectProvider: undefined }
issueRequest({ type: 'intent', intent: { ...base, pending: true }, envelope: null, voiceTraceId, utterance: query })
try {
/* Through searchPrompt, like the first attempt. Sending the bare query
reproduced the very bug that module exists to fix: no platform named,
so only one of them was searched. */
const envelope = await send(
query,
{ silent: true, voiceTraceId, searchIntent: base },
)
issueRequest({ type: 'intent', intent: { ...base, pending: false }, envelope, voiceTraceId, utterance: query })
} catch (error) {
if (error.kind === 'superseded-search') return
if (voiceTraceId) voiceError(voiceTraceId, 'Retry of voice-originated request failed', error)
issueRequest({
type: 'intent',
intent: { ...base, pending: false, error: error.message, reconnectProvider: error.provider || base.slots?.provider },
envelope: null,
voiceTraceId,
utterance: query,
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
const commerceOverlay = <>
<QrLoginPanel
ref={qrRequired ? commerceRef : null}
open={paneOpen && qrRequired}
onClose={closeQrLogin}
onRetry={retryQrLogin}
sessionId={qrSessionId}
loading={qrLoading}
error={qrError}
connectionError={sessionError}
complete={qrComplete}
ready={qrReady}
target={qrTarget}
providerLabel={PROVIDERS[qrProvider]?.label}
/>
<CommerceSidebar
ref={qrRequired ? null : commerceRef}
open={paneOpen && !qrRequired}
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
onQuickPrompt={prompt => handleTranscript(prompt, 'en-IN', 'quick-prompt')}
/>
</>
return (
<div className={`app-shell ${isFullscreen ? 'is-fullscreen' : ''}`}>
<main className="app-main" onMouseEnter={() => setPeekSidebar(true)} onMouseLeave={() => setPeekSidebar(false)} data-peek={peekSidebar || undefined}>
<VideoPlayer
onProductSelect={selectHomeProduct}
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
