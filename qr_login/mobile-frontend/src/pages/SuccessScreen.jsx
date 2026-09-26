import { useEffect } from "react";
import useSetupStore from "../store/useSetupStore";
import { MERCHANTS } from "../config/merchants";
export default function SuccessScreen() {
  const { merchants, session, isSynced, setIsSynced } = useSetupStore();
  useEffect(() => {
    const t = setTimeout(() => setIsSynced(true), 1500);
    return () => clearTimeout(t);
  }, [setIsSynced]);
  const connectedMerchants = merchants
    .map((id) => MERCHANTS.find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  return (
    <div className="success-screen">
      <div className="success-icon">✅</div>
      <div className="success-title">Login Complete!</div>
      <div className="success-sub">
        Your merchants are connected.
        <br />
        Your TV is syncing now.
      </div>
      <div className="tv-sync">
        <div className="tv-sync-icon">📺</div>
        <div className="tv-sync-text">
          <strong>{isSynced ? "Synced to TV ✓" : "Syncing to TV…"}</strong>
          <br />
          <span>
            {isSynced
              ? "TV agent unlocked! 🎉"
              : "Sending token via API polling"}
          </span>
          <br />
          {!isSynced && (
            <div className="syncing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-item">
          <span className="summary-lbl">Merchants</span>
          <span className="summary-val">{connectedMerchants || "—"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-lbl">Session</span>
          <span className="summary-val">{session || "—"}</span>
        </div>
      </div>
      <div className="final-hint">
        You can now put down your phone.
        <br />
        Your TV agent is ready to shop for you 🛒
      </div>
    </div>
  );
}
