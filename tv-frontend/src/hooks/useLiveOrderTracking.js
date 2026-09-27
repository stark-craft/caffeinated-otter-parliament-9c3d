import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "../api.js";
import { imageDataUri } from "../quickbite/envelopes.js";
import {
  normalizeTrackingSnapshot,
  trackingPhase,
  trackingPhaseRank,
  trackingSignature,
} from "../quickbite/tracking.js";
export const POLL_MS = 20_000;
export const MAX_MS = 45 * 60 * 1000;
export function useLiveOrderTracking({
  sessionId,
  activeOrder,
  onDescriptorChange,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [qr, setQr] = useState("");
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);
  const descriptorRef = useRef(null);
  const snapshotRef = useRef(null);
  const signatureRef = useRef("");
  const phaseRankRef = useRef(0);
  const qrRef = useRef("");
  const refreshRef = useRef(() => Promise.resolve());
  const inFlightRef = useRef(false);
  useEffect(() => {
    descriptorRef.current = activeOrder?.tracking
      ? { ...activeOrder.tracking }
      : null;
    snapshotRef.current = null;
    signatureRef.current = "";
    phaseRankRef.current = 0;
    setSnapshot(null);
    setHistory([]);
    const initialQr = imageDataUri(activeOrder?.qr);
    qrRef.current = initialQr;
    setQr(initialQr);
    setStale(false);
    setError("");
  }, [activeOrder?.seq]);
  const acceptSnapshot = useCallback(
    (raw) => {
      const next = normalizeTrackingSnapshot(raw);
      const nextPhase = trackingPhase(next);
      const nextRank = trackingPhaseRank(nextPhase);
      const previous = snapshotRef.current;
      // Provider snapshots can be eventually consistent. Keep visible progress monotonic.
      if (
        previous &&
        nextRank < phaseRankRef.current &&
        nextPhase !== "cancelled"
      ) {
        Object.assign(next, {
          step: previous.step,
          status: previous.status,
          order_status: previous.order_status,
          title: previous.title,
          message: next.message || previous.message,
          done: previous.done,
        });
      } else if (nextPhase !== "cancelled") {
        phaseRankRef.current = Math.max(phaseRankRef.current, nextRank);
      }
      if (next.order_id && descriptorRef.current?.order_id !== next.order_id) {
        descriptorRef.current = {
          ...descriptorRef.current,
          order_id: next.order_id,
        };
        onDescriptorChange?.(descriptorRef.current);
      }
      const acceptedPhase = trackingPhase(next);
      if (
        (acceptedPhase === "pay" || acceptedPhase === "unknown") &&
        next.payment_qr
      ) {
        const latestQr = imageDataUri(next.payment_qr);
        if (latestQr && latestQr !== qrRef.current) {
          qrRef.current = latestQr;
          setQr(latestQr);
        }
      }
      if (trackingPhaseRank(acceptedPhase) > trackingPhaseRank("pay")) {
        qrRef.current = "";
        setQr("");
      }
      const signature = trackingSignature(next);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setHistory((current) => [...current, next]);
      }
      snapshotRef.current = next;
      setSnapshot(next);
      setStale(false);
      setError("");
      return next;
    },
    [onDescriptorChange],
  );
  useEffect(() => {
    if (!sessionId || !activeOrder?.tracking) return undefined;
    let cancelled = false;
    let timer = null;
    const startedAt = Date.now();
    const poll = async (manual = false) => {
      if (cancelled || !descriptorRef.current) return;
      if (inFlightRef.current) return;
      const withinWindow = Date.now() - startedAt < MAX_MS;
      if (!withinWindow && !manual) {
        setPolling(false);
        setStale(true);
        setError(
          "Live updates paused after 45 minutes. Refresh to check again.",
        );
        return;
      }
      inFlightRef.current = true;
      setPolling(true);
      try {
        const response = await track(sessionId, descriptorRef.current);
        if (cancelled) return;
        const next = acceptSnapshot(response);
        setPolling(false);
        if (withinWindow && !next.done && !["cancelled", "delivered"].includes(trackingPhase(next)))
          timer = window.setTimeout(poll, POLL_MS);
      } catch (pollError) {
        if (cancelled) return;
        setPolling(false);
        setStale(true);
        setError(pollError.message || "Tracking is temporarily unavailable.");
        if (withinWindow) timer = window.setTimeout(poll, POLL_MS);
      } finally {
        inFlightRef.current = false;
      }
    };
    refreshRef.current = () => poll(true);
    // A zero-delay timer avoids a duplicate network call during StrictMode's effect probe.
    timer = window.setTimeout(poll, 0);
    return () => {
      cancelled = true;
      inFlightRef.current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [sessionId, activeOrder?.seq, acceptSnapshot]);
  const refresh = useCallback(async () => {
    await refreshRef.current?.();
  }, []);
  return { snapshot, history, qr, stale, error, polling, refresh };
}
