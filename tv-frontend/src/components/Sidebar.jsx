import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,} from 'react'
import {
  authBegin,
  authComplete,
  createSession,
  setLlm,
  listAddresses,
  setAddress,} from '../api.js'
const DOT = {
  Zomato: '#E23744',
  Zepto: '#7b3fe4',}
function AddressPicker({ sessionId, refresh }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)
  const load = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      setData(await listAddresses(sessionId))
    } catch (e) {
      setData({
        connected: false,
        addresses: [],
        reason: e.message,
      })
    } finally {
      setLoading(false)
      refresh?.()
    }
  }
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    listAddresses(sessionId)
      .then((d) => {
        if (alive) {
          setData(d)
          refresh?.()
        }
      })
      .catch((e) => {
        if (alive) {
          setData({
            connected: false,
            addresses: [],
            reason: e.message,
          })
        }
      })
    return () => {
      alive = false
    }
  }, [sessionId])
  const choose = async (a) => {
    setSaving(a.address_id)
    try {
      await setAddress(
        sessionId,
        a.address_id,
        a.label,
      )
      setData((d) => ({
        ...d,
        selected: a.address_id,
      }))
    } finally {
      setSaving(null)
    }
  }
  const addrs = data?.addresses || []
  return (
    <div className="addr">
      {loading && (
        <div className="addr-hint">
          Loading addresses…
        </div>
      )}
      {!loading && !addrs.length && (
        <div className="addr-hint">
          {data?.reason ||
            'No saved addresses found.'}
          <button
            className="addr-reload"
            onClick={load}
            data-settings-focus
          >
            Reload
          </button>
        </div>
      )}
      {addrs.map((a) => (
        <button
          key={a.address_id}
          className={
            'addr-row' +
            (data?.selected === a.address_id
              ? ' on'
              : '')
          }
          onClick={() => choose(a)}
          disabled={saving === a.address_id}
          data-settings-focus
        >
          <span className="addr-dot" />
          <span className="addr-label">
            {a.label}
          </span>
          {data?.selected === a.address_id && (
            <span className="addr-tick">✓</span>
          )}
        </button>
      ))}
    </div>
  )}
function PlatformRow({
  sessionId,
  p,
  refresh,}) {
  const [authUrl, setAuthUrl] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  /*
   * THIS IS THE EXACT OLD AUTH-BEGIN BEHAVIOR.
   *
   * Backend returns:
   *
   * {
   *
   status: "pending",
   *
   auth_url: "https://..."
   * }
   *
   * That auth_url is then rendered below as a clickable
   * "the login page ↗" link.
   */
  const begin = async () => {
    setBusy(true)
    setCode('')
    try {
      const r = await authBegin(
        sessionId,
        p.group,
      )
      if (r.status === 'pending') {
        setAuthUrl(r.auth_url)
      } else {
        refresh?.()
      }
    } finally {
      setBusy(false)
    }
  }
  /*
   * EXACT OLD AUTH-COMPLETE BEHAVIOR.
   */
  const finish = async () => {
    setBusy(true)
    try {
      const r = await authComplete(
        sessionId,
        p.group,
        code,
      )
      if (r.status === 'connected') {
        setAuthUrl(null)
        setCode('')
        refresh?.()
      } else {
        setAuthUrl(null)
        setCode('')
        alert(
          (r.error || 'Login failed') +
            ' — click Login again and complete it in one go.',
        )
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="plat">
      <div className="top">
        <div className="nm">
          <span
            className="pd"
            style={{
              background: DOT[p.group],
            }}
          />
          {p.group}
        </div>
        {authUrl ? (
          <span className="ok dim">
            Linking…
          </span>
        ) : p.connected ? (
          <span className="ok">
            ● Connected
            <button
              className="relogin"
              disabled={busy}
              onClick={begin}
              title="Token expired? Re-login"
              data-settings-focus
            >
              {busy ? '…' : '↻ Re-login'}
            </button>
          </span>
        ) : (
          <button
            className="btn sm"
            disabled={busy}
            onClick={begin}
            data-settings-focus
          >
            {busy ? '…' : 'Login'}
          </button>
        )}
      </div>
      {/* THIS IS THE EXACT REDIRECT-LINK SECTION */}
      {authUrl && (
        <>
          <div className="hint">
            Open{' '}
            <a
              className="link"
              href={authUrl}
              target="_blank"
              rel="noreferrer"
              data-settings-focus
            >
              the login page ↗
            </a>
            , sign in, then paste the code shown
            there:
          </div>
          <div className="codebox">
            <input
              className="inp"
              value={code}
              onChange={(e) =>
                setCode(e.target.value)
              }
              placeholder="Paste code / URL"
              data-settings-focus
            />
            <button
              className="btn sm"
              disabled={busy || !code}
              onClick={finish}
              data-settings-focus
            >
              {busy ? '…' : 'Finish'}
            </button>
          </div>
        </>
      )}
    </div>
  )}
const Sidebar = forwardRef(function Sidebar(
  {
    open = true,
    sessionId,
    platforms = [],
    llms = [],
    selectedLlm,
    onPlatformsChange,
    onLlmChange,
    onClose,
  },
  ref,) {
  const sidebarRef = useRef(null)
  const [focusIndex, setFocusIndex] =
    useState(0)
  /*
   * Re-fetch REAL session state after login/re-login.
   * This replaces the old App.refresh callback while
   * keeping the same backend-authoritative behavior.
   */
  const refresh = async () => {
    if (!sessionId) return
    try {
      const response =
        await createSession(sessionId)
      const payload =
        response?.payload &&
        typeof response.payload === 'object'
          ? response.payload
          : response
      if (Array.isArray(payload?.platforms)) {
        onPlatformsChange?.(
          payload.platforms,
        )
      }
      const llm =
        payload?.selected_llm ||
        payload?.selectedLlm
      if (llm) {
        onLlmChange?.(llm)
      }
    } catch (e) {
      console.error(
        'Failed to refresh commerce session:',
        e,
      )
    }
  }
  const switchLlm = async (name) => {
    await setLlm(sessionId, name)
    onLlmChange?.(name)
  }
  function focusItems() {
    if (!sidebarRef.current) return []
    return [
      ...sidebarRef.current.querySelectorAll(
        '[data-settings-focus]:not(:disabled)',
      ),
    ].filter((el) => {
      const style =
        window.getComputedStyle(el)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        el.getClientRects().length > 0
      )
    })
  }
  useEffect(() => {
    if (!open) return
    const frame =
      requestAnimationFrame(() => {
        const items = focusItems()
        if (items.length) {
          setFocusIndex(0)
          items[0].focus()
        }
      })
    return () =>
      cancelAnimationFrame(frame)
  }, [open])
  useImperativeHandle(
    ref,
    () => ({
      handleKey(key) {
        if (!open) return false
        if (
          key === 'Escape' ||
          key === 'Backspace'
        ) {
          onClose?.()
          return true
        }
        const active =
          document.activeElement
        /*
         * Let the OAuth input behave normally while
         * the user types/pastes the login code.
         */
        if (
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA'
        ) {
          return false
        }
        const items = focusItems()
        if (!items.length) return false
        let current =
          items.indexOf(active)
        if (current < 0) {
          current = focusIndex
        }
        if (key === 'ArrowDown') {
          const next = Math.min(
            items.length - 1,
            current + 1,
          )
          setFocusIndex(next)
          items[next]?.focus()
          items[next]?.scrollIntoView({
            block: 'nearest',
          })
          return true
        }
        if (key === 'ArrowUp') {
          const next = Math.max(
            0,
            current - 1,
          )
          setFocusIndex(next)
          items[next]?.focus()
          items[next]?.scrollIntoView({
            block: 'nearest',
          })
          return true
        }
        if (
          key === 'Enter' ||
          key === ' '
        ) {
          items[current]?.click()
          return true
        }
        return false
      },
    }),
    [
      open,
      focusIndex,
      onClose,
    ],
  )
  if (!open) return null
  return (
    <aside
      ref={sidebarRef}
      className="sidebar"
      onClick={(e) =>
        e.stopPropagation()
      }
      onPointerDown={(e) =>
        e.stopPropagation()
      }
    >
      <div className="brand">
        <div className="mark">C</div>
        <div className="name">
          <b>Commerce</b> Agent
          <small>
            order · compare · checkout
          </small>
        </div>
        {onClose && (
          <button
            className="s-close"
            onClick={onClose}
            title="Hide panel"
            data-settings-focus
          >
            ×
          </button>
        )}
      </div>
      <div className="s-label">
        Connect platforms
      </div>
      {platforms.map((p) => (
        <PlatformRow
          key={p.group}
          sessionId={sessionId}
          p={p}
          refresh={refresh}
        />
      ))}
      <div className="s-label">
        Delivery address
      </div>
      <AddressPicker
        sessionId={sessionId}
        refresh={refresh}
      />
      <div className="s-label">
        Model
      </div>
      <div className="llms">
        {llms.map((m) => (
          <button
            key={m}
            className={
              'pill' +
              (m === selectedLlm
                ? ' on'
                : '')
            }
            onClick={() =>
              switchLlm(m)
            }
            data-settings-focus
          >
            {m}
          </button>
        ))}
      </div>
    </aside>
  )})
export default Sidebar
