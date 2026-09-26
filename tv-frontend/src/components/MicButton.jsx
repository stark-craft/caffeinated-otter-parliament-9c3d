import { useRef, useState } from "react";
import { sttTranscribe } from "../api.js";
import { normalizeAudioMime } from "../quickbite/audio.js";
export default function MicButton({
  onTranscript,
  disabled = false,
  focusable = false,
  onFocus,
  showLabel = false,
}) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const mime = normalizeAudioMime(recorder.mimeType);
        const blob = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setBusy(true);
        try {
          const result = await sttTranscribe(blob);
          if (result.error) throw new Error(result.error);
          if (result.transcript) onTranscript?.(result.transcript);
        } catch (transcribeError) {
          setError(transcribeError.message || "Voice transcription failed.");
        } finally {
          setBusy(false);
        }
      };
      recorder.start();
      setRecording(true);
    } catch (mediaError) {
      setError(mediaError.message || "Microphone permission was not granted.");
    }
  }
  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }
  return (
    <div className="mic-control">
      <button
        className={`mic-button ${recording ? "is-recording" : ""}`}
        data-settings-focus={focusable ? "" : undefined}
        type="button"
        disabled={disabled || busy}
        onClick={recording ? stop : start}
        onFocus={onFocus}
        aria-label={recording ? "Stop voice input" : "Start voice input"}
        title={recording ? "Stop recording" : "Voice command"}
      >
        {busy
          ? "…"
          : recording
            ? showLabel
              ? "■ Stop recording"
              : "■"
            : showLabel
              ? "🎙 Voice command"
              : "🎙"}
      </button>
      {error && (
        <span className="mic-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
