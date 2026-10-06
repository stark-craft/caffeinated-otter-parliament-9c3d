import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import QuickBiteLogo from './QuickBiteLogo.jsx'
import { qrFocusAfterArrow } from '../../quickbite/navigation.js'
import './QrLoginPanel.css'

const MOBILE_APP_URL = import.meta.env.DEV
  ? new URL('/mobile/', window.location.href).href
  : import.meta.env.VITE_MOBILE_APP_URL || new URL('/mobile/', window.location.href).href

const QrLoginPanel = forwardRef(function QrLoginPanel({
  open,
  onClose,
  onRetry,
  sessionId,
  loading,
  error,
  connectionError,
  complete,
  ready,
  target,
  providerLabel,
}, ref) {
  const mobileUrl = sessionId
    ? `${MOBILE_APP_URL}${MOBILE_APP_URL.includes('?') ? '&' : '?'}session=${encodeURIComponent(sessionId)}`
    : ''
  const canRetry = Boolean(error || complete)
  const [focusAction, setFocusAction] = useState('close')
  const panelRef = useRef(null)
  useLayoutEffect(() => {
    if (!open) return
    const focus = () => panelRef.current?.querySelector(`[data-qb-focus="${focusAction}"]`)?.focus({ preventScroll: true })
    focus()
    // A newly opened panel may still inherit visibility:hidden until the
    // opening style is resolved. Retry after that frame, never on a timer.
    const frame = window.requestAnimationFrame(focus)
    return () => window.cancelAnimationFrame(frame)
  }, [open, focusAction, canRetry])

  useEffect(() => {
    if (!open || !mobileUrl) return
    console.log('[CommAgent QR] Phone login QR is available', { phonePage: MOBILE_APP_URL })
  }, [open, mobileUrl])

  useEffect(() => {
    if (!open || mobileUrl) return
    const details = {
      configuredPhonePage: MOBILE_APP_URL,
      expectedBackendCall: 'POST /api/qr/session → { session_id: "..." }',
      checkingMerchantConnections: !ready,
      requestingQrSession: loading,
      error: error || null,
    }
    if (error) console.error('[CommAgent QR] Cannot display login QR yet', details)
    else console.log('[CommAgent QR] Waiting for a backend QR session ID', details)
  }, [open, mobileUrl, ready, loading, error])

  useEffect(() => {
    if (open) setFocusAction(canRetry ? 'retry' : 'close')
  }, [open, canRetry])

  useImperativeHandle(ref, () => ({
    handleKey(key) {
      if (!open) return false
      if (key === 'Escape' || key === 'Backspace') {
        onClose()
      } else if (key.startsWith('Arrow')) {
        setFocusAction((current) => qrFocusAfterArrow(current, key, canRetry))
      } else if (key === 'Enter' || key === ' ') {
        if (focusAction === 'retry' && canRetry) onRetry()
        else onClose()
      }
      return true
    },
  }), [open, onClose, onRetry, canRetry, focusAction])

  return (
    <aside ref={panelRef} inert={!open} data-focus-key={focusAction} className={`qb-panel qb-qr-panel ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="QuickBite phone pairing"
      onTransitionEnd={event => {
        if (open && event.target === event.currentTarget && event.propertyName === 'transform')
          panelRef.current?.querySelector(`[data-qb-focus="${focusAction}"]`)?.focus({ preventScroll: true })
      }}>
      <header className="qb-panel-top"><QuickBiteLogo /></header>
      <main className="qb-panel-body qb-qr-body">
        <p className="qb-qr-eyebrow">CONNECT YOUR MERCHANTS</p>
        <h1>{providerLabel ? `Reconnect ${providerLabel}` : target === 'grocery' ? 'Unlock Grocery' : target === 'food' ? 'Unlock Food' : 'Scan to start shopping'}</h1>
        <p className="qb-qr-description">
          {providerLabel
            ? `Connect ${providerLabel} on your phone, then retry the original request.`
            : target === 'grocery'
            ? 'Connect Zepto or Swiggy on your phone to shop groceries.'
            : target === 'food'
              ? 'Connect Zomato or Swiggy on your phone to order food.'
              : 'Scan with your phone, then connect at least one merchant to continue.'}
        </p>
        {sessionId && mobileUrl ? (
          <div className="qb-qr-code" role="img" aria-label="QR code for phone merchant login">
            <QRCodeSVG value={mobileUrl} size={216} level="M" bgColor="#ffffff" fgColor="#10141c" />
          </div>
        ) : (
          <div className="qb-qr-placeholder" aria-hidden="true">{loading || !ready ? 'Preparing pairing…' : 'QR unavailable'}</div>
        )}
        <p className="qb-qr-status" role="status">
          {!ready ? 'Checking merchant connections…'
            : error ? `Could not start pairing: ${error}`
              : complete ? 'Phone setup finished. Waiting for an active merchant connection…'
                : sessionId ? 'Waiting for phone pairing…'
                  : 'Preparing pairing…'}
        </p>
        {connectionError && <p className="qb-qr-status" role="alert">{connectionError}</p>}
        {sessionId && <p className="qb-qr-session">Session: {sessionId}</p>}
        {canRetry && <button type="button" data-qb-focus="retry" className={`qb-qr-retry ${open && focusAction === 'retry' ? 'is-focused' : ''}`} onClick={onRetry} onMouseMove={() => setFocusAction('retry')} onFocus={() => setFocusAction('retry')}>Try pairing again</button>}
      </main>
      <nav className="qb-bottom-nav" aria-label="QuickBite navigation">
        <button type="button" data-qb-focus="close" className={`qb-exit-button ${open && focusAction === 'close' ? 'is-focused' : ''}`} onClick={onClose} onMouseMove={() => setFocusAction('close')} onFocus={() => setFocusAction('close')}>Close</button>
      </nav>
    </aside>
  )
})

export default QrLoginPanel
