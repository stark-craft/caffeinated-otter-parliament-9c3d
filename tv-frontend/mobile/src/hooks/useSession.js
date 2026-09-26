import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import useSetupStore from "../store/useSetupStore";
import { validateSession } from "../services/api";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1500;
export default function useSession() {
  const [searchParams] = useSearchParams();
  const setSession = useSetupStore((s) => s.setSession);
  const setSessionValid = useSetupStore((s) => s.setSessionValid);
  const session = useSetupStore((s) => s.session);
  const sessionValid = useSetupStore((s) => s.sessionValid);
  const sessionLoading = useSetupStore((s) => s.sessionLoading);
  useEffect(() => {
    const sessionId = searchParams.get("session");
    if (!sessionId) {
      setSessionValid(false);
      return;
    }
    setSession(sessionId);
    let attempt = 0;
    let cancelled = false;
    async function tryValidate() {
      while (attempt < MAX_RETRIES && !cancelled) {
        attempt++;
        try {
          const res = await validateSession(sessionId);
          if (cancelled) return;
          if (res.valid) {
            setSessionValid(true);
            return;
          }
        } catch {
          // 404 or network error — retry
        }
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
      if (!cancelled) {
        setSessionValid(false);
      }
    }
    tryValidate();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSession, setSessionValid]);
  return { session, sessionValid, sessionLoading };
}
