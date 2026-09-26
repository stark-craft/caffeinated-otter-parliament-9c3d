import { useState, useRef, useEffect } from "react";
import useSetupStore from "../store/useSetupStore";
import { MERCHANTS } from "../config/merchants";
import {
  beginMcpLogin,
  getMcpLoginStatus,
  completeSession,
} from "../services/api";
export default function MerchantLogin() {
  const merchants = useSetupStore((s) => s.merchants);
  const toggleMerchant = useSetupStore((s) => s.toggleMerchant);
  const goNext = useSetupStore((s) => s.goNext);
  const session = useSetupStore((s) => s.session);
  const [loginStates, setLoginStates] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const pollRefs = useRef({});
  useEffect(() => {
    return () => {
      Object.values(pollRefs.current).forEach((id) => id && clearInterval(id));
    };
  }, []);
  // On mount, check which merchants already have a valid cached token
  // and pre-mark them as connected (show "Connected" instead of "Log In").
  useEffect(() => {
    let cancelled = false;
    MERCHANTS.forEach((m) => {
      getMcpLoginStatus(m.id)
        .then((res) => {
          if (cancelled) return;
          if (res.connected) {
            setLoginStates((s) => ({ ...s, [m.id]: "connected" }));
            if (!useSetupStore.getState().merchants.includes(m.id)) {
              toggleMerchant(m.id);
            }
          }
        })
        .catch(() => {
          // Status check failed — leave as idle
        });
    });
    return () => {
      cancelled = true;
    };
  }, [toggleMerchant]);
  const startPolling = (merchantId) => {
    if (pollRefs.current[merchantId]) {
      clearInterval(pollRefs.current[merchantId]);
    }
    pollRefs.current[merchantId] = setInterval(async () => {
      try {
        const res = await getMcpLoginStatus(merchantId);
        if (res.connected) {
          clearInterval(pollRefs.current[merchantId]);
          pollRefs.current[merchantId] = null;
          setLoginStates((s) => ({ ...s, [merchantId]: "connected" }));
          if (!merchants.includes(merchantId)) toggleMerchant(merchantId);
        }
      } catch {
        // keep polling
      }
    }, 2000);
  };
  const handleLogin = async (merchantId, force = false) => {
    setLoginStates((s) => ({ ...s, [merchantId]: "loading" }));
    setErrors((e) => ({ ...e, [merchantId]: "" }));
    try {
      const res = await beginMcpLogin(merchantId, force);
      if (res.status === "connected") {
        setLoginStates((s) => ({ ...s, [merchantId]: "connected" }));
        if (!merchants.includes(merchantId)) toggleMerchant(merchantId);
      } else if (res.status === "pending" && res.auth_url) {
        setLoginStates((s) => ({ ...s, [merchantId]: "pending" }));
        window.open(res.auth_url, "_blank");
        startPolling(merchantId);
      } else {
        setLoginStates((s) => ({ ...s, [merchantId]: "error" }));
        setErrors((e) => ({
          ...e,
          [merchantId]: res.error || "Unexpected response from server",
        }));
      }
    } catch (err) {
      setLoginStates((s) => ({ ...s, [merchantId]: "error" }));
      setErrors((e) => ({ ...e, [merchantId]: err.message || "Login failed" }));
    }
  };
  const handleContinue = async () => {
    setSubmitting(true);
    try {
      if (session) {
        await completeSession(session);
      }
    } catch {
      // non-fatal — TV polling will still work via login_complete
    }
    setSubmitting(false);
    goNext();
  };
  return (
    <>
      <div className="step-header">
        <div className="step-num">Step 2 of 2</div>
        <div className="step-title">Log in to Merchants</div>
        <div className="step-sub">
          Log in to the merchants you want to shop with
        </div>
      </div>
      <div className="merchant-list">
        {MERCHANTS.map((m) => {
          const state = loginStates[m.id] || "idle";
          return (
            <div
              key={m.id}
              className={`m-card ${state === "connected" ? "connected" : ""}`}
            >
              <div className="m-icon">{m.icon}</div>
              <div className="m-info">
                <div className="m-name">{m.name}</div>
                <div className="m-sub">{m.subtitle}</div>
              </div>
              {state === "connected" ? (
                <div className="connected-actions">
                  <div className="connected-badge">✓ Connected</div>
                  <button
                    className="reconnect-btn"
                    onClick={() => handleLogin(m.id, true)}
                    disabled={state === "loading"}
                  >
                    Re-connect
                  </button>
                </div>
              ) : state === "pending" ? (
                <div className="waiting-badge">
                  <span className="spinner" />
                  Waiting…
                </div>
              ) : (
                <button
                  className="login-btn"
                  onClick={() => handleLogin(m.id)}
                  disabled={state === "loading"}
                >
                  {state === "loading" ? "…" : "Log In"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {errors &&
        Object.entries(errors).map(([id, msg]) =>
          msg ? (
            <div key={id} className="error-msg">
              {msg}
            </div>
          ) : null,
        )}
      {Object.values(loginStates).some((s) => s === "pending") && (
        <div className="hint">
          💡 Complete the login in the browser tab that just opened. This page
          will update automatically.
        </div>
      )}
      <button
        className="cta accent"
        onClick={handleContinue}
        disabled={merchants.length === 0 || submitting}
      >
        {submitting ? "Syncing…" : "Continue →"}
      </button>
    </>
  );
}
