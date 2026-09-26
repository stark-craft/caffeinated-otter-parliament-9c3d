import { useState, useEffect } from "react";
import useSetupStore from "../store/useSetupStore";
import { saveUserProfile, getUserProfile } from "../services/api";
export default function UserDetails() {
  const goNext = useSetupStore((s) => s.goNext);
  // Local state for form fields — always editable, never overwritten by
  // async store updates from useSession's pre-fill or session validation.
  const [name, setName] = useState(() => useSetupStore.getState().name);
  const [vpa, setVpa] = useState(() => useSetupStore.getState().vpa);
  const [phone, setPhone] = useState(() => useSetupStore.getState().phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Pre-fill empty fields from backend profile. Uses functional updates so
  // it only fills when the field is still empty — never overwrites user edits.
  useEffect(() => {
    let cancelled = false;
    getUserProfile()
      .then((profile) => {
        if (cancelled) return;
        setName((prev) => (!prev && profile.name ? profile.name : prev));
        setVpa((prev) => (!prev && profile.vpa ? profile.vpa : prev));
        setPhone((prev) => (!prev && profile.phone ? profile.phone : prev));
      })
      .catch(() => {
        // Profile fetch failed — user will fill manually
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const handleContinue = async () => {
    if (!name.trim() || !vpa.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    // Sync local values to the store so downstream steps have them
    useSetupStore.getState().setName(name);
    useSetupStore.getState().setVpa(vpa);
    useSetupStore.getState().setPhone(phone);
    try {
      await saveUserProfile({ name, vpa, phone });
    } catch (err) {
      // Non-fatal: profile save failed (e.g. backend not restarted),
      // but we still let the user proceed with the flow.
      console.warn("Failed to save user profile:", err.message);
    } finally {
      setSaving(false);
    }
    goNext();
  };
  const isValid = name.trim() && vpa.trim() && phone.trim();
  return (
    <>
      <div className="step-header">
        <div className="step-num">Step 1 of 2</div>
        <div className="step-title">Your Details</div>
        <div className="step-sub">
          Confirm your details for checkout and payments
        </div>
      </div>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            className="form-input"
            type="text"
            placeholder="Gaurav Sharma"
            value={name}
            readOnly
          />
        </div>
        <div className="form-group">
          <label className="form-label">Mobile Number</label>
          <input
            className="form-input"
            type="tel"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            readOnly
          />
        </div>
        <div className="form-group">
          <label className="form-label">UPI ID (VPA)</label>
          <input
            className="form-input"
            type="text"
            placeholder="gaurav@oksbi"
            value={vpa}
            onChange={(e) => setVpa(e.target.value)}
          />
        </div>
      </div>
      {error && <div className="error-msg">❌ {error}</div>}
      <button
        className="cta accent"
        onClick={handleContinue}
        disabled={!isValid || saving}
      >
        {saving ? "Saving…" : "Continue →"}
      </button>
    </>
  );
}
