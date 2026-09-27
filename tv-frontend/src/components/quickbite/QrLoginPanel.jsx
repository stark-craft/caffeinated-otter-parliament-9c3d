import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
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
}, ref) {
  const mobileUrl = sessionId
    ? `${MOBILE_APP_URL}${MOBILE_APP_URL.includes('?') ? '&' : '?'}session=${encodeURIComponent(sessionId)}`
    : ''
  const canRetry = Boolean(error || complete)
  const [focusAction, setFocusAction] = useState('close')

  useEffect(() => {
    if (!open || !mobileUrl) return
    console.log(`[CommAgent QR] Exact phone login URL encoded in the QR (you can type this on your phone): ${mobileUrl}`)
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
    <aside className={`qb-panel qb-qr-panel ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="QuickBite phone pairing">
      <header className="qb-panel-top"><QuickBiteLogo /></header>
      <main className="qb-panel-body qb-qr-body">
        <p className="qb-qr-eyebrow">CONNECT YOUR MERCHANTS</p>
        <h1>{target === 'grocery' ? 'Unlock Grocery' : target === 'food' ? 'Unlock Food' : 'Scan to start shopping'}</h1>
        <p className="qb-qr-description">
          {target === 'grocery'
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
        {canRetry && <button type="button" className={`qb-qr-retry ${focusAction === 'retry' ? 'is-focused' : ''}`} onClick={onRetry} onMouseEnter={() => setFocusAction('retry')} onFocus={() => setFocusAction('retry')}>Try pairing again</button>}
      </main>
      <nav className="qb-bottom-nav" aria-label="QuickBite navigation">
        <button type="button" className={`qb-exit-button ${focusAction === 'close' ? 'is-focused' : ''}`} onClick={onClose} onMouseEnter={() => setFocusAction('close')} onFocus={() => setFocusAction('close')}>Close</button>
      </nav>
    </aside>
  )
})

export default QrLoginPanel
