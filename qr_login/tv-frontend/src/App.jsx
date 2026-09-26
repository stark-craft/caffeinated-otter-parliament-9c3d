import React, { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/qr'
const MOBILE_APP_URL = import.meta.env.VITE_MOBILE_APP_URL || 'http://localhost:3000'
const POLL_INTERVAL = parseInt(import.meta.env.VITE_POLL_INTERVAL_MS) || 2000

async function apiCreateSession() {
  const res = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}

async function apiGetSessionStatus(sessionId) {
  const res = await fetch(`${API_BASE}/session/${sessionId}/status`)
  if (!res.ok) return null
  return res.json()
}

function QrPairingScreen({ sessionId, onComplete }) {
  const [waiting, setWaiting] = useState(true)
  const pollRef = useRef(null)

  const mobileUrl = `${MOBILE_APP_URL}?session=${sessionId}`

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiGetSessionStatus(sessionId)
        if (status && status.login_complete) {
          clearInterval(pollRef.current)
          onComplete()
        }
      } catch {
        // keep polling
      }
    }, POLL_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [sessionId, onComplete])

  return (
    <div className="screen active" id="s-pair">
      <div className="pair-left">
        <div className="qr-frame">
          <QRCodeSVG value={mobileUrl} size={240} bgColor="#0C1018" fgColor="#EEF2FF" />
          <div className="scan-pulse" />
        </div>

        <div className="qr-hint">Scan with your phone to log in</div>

        <a
          className="open-mobile-btn"
          href={mobileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          📱 Open Mobile App (Testing)
        </a>

        <div className="session-id">{sessionId}</div>
      </div>

      <div className="pair-right">
        <div className="pair-badge">
          <span className="pair-badge-dot" />
          Agentic Commerce
        </div>

        <h1 className="pair-title">Connect your merchants</h1>

        <p className="pair-desc">
          Scan the QR code with your phone to log in to Zomato, Swiggy, and Zepto.
          Your tokens will be saved automatically — no paste needed.
        </p>

        <div className="pair-steps">
          <div className="pair-step">
            <span className="pair-step-num">1</span>
            <span>Scan the QR code with your phone</span>
          </div>

          <div className="pair-step">
            <span className="pair-step-num">2</span>
            <span>Log in to each merchant in the browser</span>
          </div>

          <div className="pair-step">
            <span className="pair-step-num">3</span>
            <span>TV detects completion automatically</span>
          </div>
        </div>

        {waiting && (
          <div className="pair-waiting">
            <span className="pair-spinner" />
            Waiting for phone pairing…
          </div>
        )}
      </div>
    </div>
  )
}

function SuccessScreen({ sessionId }) {
  return (
    <div className="screen active" id="s-success">
      <div className="success-wrap">
        <div className="success-emoji">✅</div>

        <h1 className="success-title">Login Complete!</h1>

        <p className="success-sub">
          All merchants are connected.<br />
          The commerce agent is ready to use.
        </p>

        <div className="success-session">
          Session: <span className="mono">{sessionId}</span>
        </div>

        <div className="success-hint">
          Tokens saved to <code>.tokens/</code> — the existing commerce agent
          can use them immediately without re-login.
        </div>
      </div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('pair') // pair | success
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    apiCreateSession()
      .then((data) => {
        setSessionId(data.session_id)
      })
      .catch((err) => {
        setError(err.message)
      })
  }, [])

  const handleComplete = React.useCallback(() => {
    setScreen('success')
  }, [])

  if (error) {
    return (
      <div className="app-container">
        <div className="error-screen">
          <h2>⚠️ Failed to start</h2>
          <p>{error}</p>
          <p>Make sure the backend is running on port 8077.</p>
        </div>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="app-container">
        <div className="loading-screen">Starting…</div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {screen === 'pair' && (
        <QrPairingScreen sessionId={sessionId} onComplete={handleComplete} />
      )}

      {screen === 'success' && <SuccessScreen sessionId={sessionId} />}
    </div>
  )
}

export default App
