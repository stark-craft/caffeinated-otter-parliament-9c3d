import { useCallback, useEffect, useRef, useState } from "react";
import { sttTranscribe } from "../api.js";
import { normalizeAudioMime } from "../quickbite/audio.js";
import { scriptedFor } from "../quickbite/scriptedUtterances.js";
import { initial, next } from "../quickbite/voiceMachine.js";
import { newVoiceTrace, voiceError, voiceLog, voiceWarn } from "../quickbite/voiceDiagnostics.js";
const PTT =
  /^[1-9]$/; /* Hold-to-talk on a digit key (spec §8.5). Registered in the capture phase so
it runs ahead of the document listener at VideoPlayer.jsx:883 and can
suppress navigation while the microphone is open.
Every transition goes through the reducer in quickbite/voiceMachine.js; this
hook performs effects only when the reducer says to. That is what keeps the
three lifecycle bugs fixed: a release during the permission prompt lands in
`cancelled`, a post-abort chunk arrives with `usable: false`, and a new
press bumps `requestId` so the superseded response is dropped. */
export function useVoiceKey({
  onTranscript,
  disabled = false,
  getKeyterms,
  demoVoice = false,
}) {
  const [phase, setPhase] = useState("idle");
  const [transcript, setTranscript] = useState("");
  /* Shown when the hold-to-talk key could not listen, held separately from
`phase`: the no-mic path aborts the machine first, so phase is already
`idle` and the overlay - which renders nothing when idle - showed the user
nothing at all. */
  const [scripted, setScripted] = useState("");
  const [micError, setMicError] = useState("");
  const noticeTimer = useRef(0);
  const machine = useRef(initial);
  const recorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const startedAt = useRef(0);
  const traceByRequest = useRef(new Map());
  /* One timer for every transient voice message. Two separate setTimeouts
shared a single ref before, so the later one orphaned the earlier. */
  const showMicError = useCallback((message) => {
    setScripted("");
    setMicError(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setMicError(""), 6000);
  }, []);
  const dispatch = useCallback((event) => {
    const state = next(machine.current, event);
    machine.current = state;
    setPhase(state.phase);
    return state;
  }, []);
  const releaseStream = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
  }, []);
  const send = useCallback(
    async (requestId) => {
      const traceId = traceByRequest.current.get(requestId);
      const blob = new Blob(chunks.current, {
        type: normalizeAudioMime(recorder.current?.mimeType),
      });
      chunks.current = [];
      releaseStream();
      try {
        // Read at send time, not capture time: the view has usually changed
        // since the hook was created.
        const keyterms = getKeyterms?.() || [];
        voiceLog(traceId, "Chrome /stt request", { bytes: blob.size, mime: blob.type, keyterms });
        const result = await sttTranscribe(blob, keyterms);
        voiceLog(traceId, "Chrome /stt response", result);
        const state = dispatch({ type: "RESULT", requestId });
        if (state.stale) {
          voiceWarn(traceId, "Stale STT response discarded", { requestId });
          return;
        }
        // superseded by a newer utterance
        if (result?.transcript) {
          setTranscript(result.transcript);
          voiceLog(traceId, "Transcript → CommAgent handleTranscript", { transcript: result.transcript, language: result.language || "unknown" });
          Promise.resolve(onTranscript?.(result.transcript, result.language || "unknown", "chrome-ptt", traceId))
            .then(() => voiceLog(traceId, "CommAgent transcript handler completed", { source: "chrome-ptt" }))
            .catch((error) => voiceError(traceId, "CommAgent transcript handler failed", error));
          return;
        }
        voiceWarn(traceId, "STT returned no transcript", { error: result?.error || null });
        /* Nothing heard. This used to return in silence: the user held the key,
released, and the app did nothing whatsoever - indistinguishable from
the key not working. The endpoint reports its own failures in
`error`, so say which of the two happened. */
        showMicError(
          result?.error
            ? "Could not transcribe that. Try again."
            : "Did not catch that. Hold the key and speak.",
        );
      } catch (error) {
        voiceError(traceId, "Chrome voice flow failed", error);
        console.error("transcription failed", error);
        dispatch({ type: "RESULT", requestId });
        showMicError("Could not reach speech recognition. Try again.");
      } finally {
        traceByRequest.current.delete(requestId);
      }
    },
    [dispatch, getKeyterms, onTranscript, releaseStream, showMicError],
  );
  const press = useCallback(
    async (digit) => {
      if (disabled) {
        voiceWarn(null, "Chrome voice key ignored: commerce session not ready", { key: digit });
        return;
      }
      window.clearTimeout(noticeTimer.current);
      setScripted("");
      setMicError("");
      const state = dispatch({ type: "PRESS" });
      if (state.phase !== "acquiring") {
        voiceLog(traceByRequest.current.get(state.requestId), "Chrome voice key pressed while another utterance is active", { key: digit, phase: state.phase });
        return;
      }
      const requestId = state.requestId;
      const traceId = newVoiceTrace("chrome-ptt");
      traceByRequest.current.set(requestId, traceId);
      voiceLog(traceId, "Chrome hold-to-talk key pressed", { key: digit, requestId, phase: state.phase });
      if (!navigator.mediaDevices?.getUserMedia) {
        voiceWarn(traceId, "Browser microphone API unavailable", { secureContext: window.isSecureContext });
        dispatch({ type: "ABORT" });
        /* This key is hold-to-talk. Submitting a canned utterance because the
microphone is missing makes the app search for words the user never
said - "why biryani? I never said biryani". The scripted lines stay
for demoing without a mic (spec 8.5, Task 14 Step 10) but only when
asked for explicitly. Otherwise say why nothing was heard. */
        const line = demoVoice ? scriptedFor(digit) : "";
        if (line) {
          setTranscript(line);
          setScripted(line);
          noticeTimer.current = window.setTimeout(() => setScripted(""), 6000);
          voiceLog(traceId, "Demo transcript → CommAgent handleTranscript", { transcript: line });
          Promise.resolve(onTranscript?.(line, "scripted", "chrome-demo", traceId))
            .then(() => voiceLog(traceId, "CommAgent demo transcript handler completed", { source: "chrome-demo" }))
            .catch((error) => voiceError(traceId, "CommAgent demo transcript handler failed", error));
          traceByRequest.current.delete(requestId);
          return;
        }
        showMicError(
          window.isSecureContext
            ? "No microphone available on this device."
            : "No microphone: open this page on http://localhost, not an IP address.",
        );
        traceByRequest.current.delete(requestId);
        return;
      }
      try {
        voiceLog(traceId, "Requesting Chrome microphone permission", { audio: true });
        const granted = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const after = dispatch({ type: "GRANTED", requestId });
        // Released while the prompt was open, or superseded: drop the stream.
        if (after.release || after.phase !== "recording") {
          voiceWarn(traceId, "Microphone granted after key release; discarding stream", { phase: after.phase });
          granted.getTracks().forEach((t) => t.stop());
          traceByRequest.current.delete(requestId);
          return;
        }
        voiceLog(traceId, "Chrome microphone granted; starting MediaRecorder", { trackCount: granted.getTracks().length });
        stream.current = granted;
        const rec = new MediaRecorder(granted);
        recorder.current = rec;
        chunks.current = [];
        startedAt.current = Date.now();
        rec.ondataavailable = (e) => {
          if (e.data?.size) chunks.current.push(e.data);
        };
        rec.onstop = () => {
          voiceLog(traceId, "MediaRecorder stopped", { chunks: chunks.current.length, bytes: chunks.current.reduce((total, chunk) => total + chunk.size, 0) });
          const s = dispatch({ type: "CHUNKS", requestId });
          if (!s.usable) {
            voiceWarn(traceId, "Recorded chunks discarded", { phase: s.phase, cancelled: s.cancelled });
            chunks.current = [];
            releaseStream();
            traceByRequest.current.delete(requestId);
            return;
          }
          send(requestId);
        };
        rec.start();
        voiceLog(traceId, "MediaRecorder recording", { mime: rec.mimeType });
      } catch (error) {
        voiceError(traceId, "Chrome microphone acquisition failed", error);
        console.error("microphone unavailable", error);
        dispatch({ type: "DENIED", requestId });
        releaseStream();
        traceByRequest.current.delete(requestId);
      }
    },
    [
      demoVoice,
      disabled,
      dispatch,
      onTranscript,
      releaseStream,
      send,
      showMicError,
    ],
  );
  const release = useCallback(() => {
    const requestId = machine.current.requestId;
    const traceId = traceByRequest.current.get(requestId);
    const state = dispatch({
      type: "RELEASE",
      heldMs: Date.now() - startedAt.current,
    });
    voiceLog(traceId, "Chrome hold-to-talk key released", { requestId, phase: state.phase, heldMs: state.heldMs });
    if (recorder.current?.state === "recording") recorder.current.stop();
    else if (state.phase === "idle") releaseStream();
  }, [dispatch, releaseStream]);
  const abort = useCallback(() => {
    voiceWarn(traceByRequest.current.get(machine.current.requestId), "Chrome voice recording aborted", { phase: machine.current.phase });
    dispatch({ type: "ABORT" });
    if (recorder.current?.state === "recording") recorder.current.stop();
    else releaseStream();
  }, [dispatch, releaseStream]);
  // The timer outlives the component otherwise: a pending setState fires on an
  // unmounted hook when the panel closes during a voice notice.
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    const editable = (t) =>
      t?.tagName === "INPUT" ||
      t?.tagName === "TEXTAREA" ||
      t?.isContentEditable;
    function onKeyDown(event) {
      if (editable(event.target)) return;
      const ptt = PTT.test(event.key) || event.key === "PageDown";
      if (ptt) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) press(event.key === "PageDown" ? "1" : event.key);
        return;
      }
      if (machine.current.phase === "recording") {
        if (event.key === "Escape" || event.key === "Backspace") {
          event.preventDefault();
          event.stopPropagation();
          abort();
          return;
        }
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Enter",
            " ",
          ].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
    function onKeyUp(event) {
      if (editable(event.target)) return;
      if (!(PTT.test(event.key) || event.key === "PageDown")) return;
      event.preventDefault();
      event.stopPropagation();
      release();
    }
    function onBlur() {
      if (machine.current.phase !== "idle") abort();
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [abort, press, release]);
  return { phase, transcript, scripted, micError };
}
