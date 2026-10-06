import { safeVoiceDetails } from './voiceDiagnostics.js'
import { responseProviders } from './providers.js'
import { paymentQrFromEnvelope, trackingFromEnvelope } from './envelopes.js'
import { confirmedCodCheckout } from './payMode.js'

export function commerceLog(stage, details) {
  if (!import.meta.env?.DEV && (typeof window === 'undefined' || window.localStorage.getItem('ca_debug') !== '1')) return
  console.info(`[CommerceFlow] ${stage}`, safeVoiceDetails(details))
}

export function responseAttribution(envelope) {
  return { widget: envelope?.widget || null, providers: responseProviders(envelope),
    hasTracking: Boolean(trackingFromEnvelope(envelope)),
    hasPaymentInstructions: Boolean(paymentQrFromEnvelope(envelope, { allowImageFallback: !confirmedCodCheckout(envelope) })) }
}
