/* The capture lifecycle as a pure reducer, so the cases that broke the first
 * attempt are testable rather than asserted:
 *
 *  - releasing the key while the permission prompt is open must NOT end up
 *    recording once the promise resolves
 *  - aborting must discard the final chunk MediaRecorder.stop() emits, which
 *    clearing the buffer beforehand cannot do
 *  - a new utterance during transcription supersedes the old one instead of
 *    being rejected, which is what "barge-in" actually means
 *
 * `requestId` is the identity a late response is checked against. */

export const MIN_RECORDING_MS = 300

export const initial = {
  phase: 'idle',
  requestId: 0,
  cancelled: false,
  heldMs: 0,
}

export function next(state, event) {
  const { phase } = state

  switch (event.type) {
    case 'PRESS':
      // Supersedes anything in flight: the previous requestId is now stale.
      if (phase === 'recording') return state
      return {
        phase: 'acquiring',
        requestId: state.requestId + 1,
        cancelled: false,
        heldMs: 0,
      }

    case 'GRANTED':
      if (event.requestId !== state.requestId) return { ...state, release: true }
      if (phase !== 'acquiring') return { ...state, release: true }

      // The key came back up while the prompt was open.
      if (state.cancelled) {
        return {
          ...initial,
          requestId: state.requestId,
          release: true,
        }
      }

      return { ...state, phase: 'recording' }

    case 'DENIED':
      if (event.requestId !== state.requestId) return state
      return {
        ...initial,
        requestId: state.requestId,
      }

    case 'RELEASE':
      if (phase === 'acquiring') return { ...state, cancelled: true }
      if (phase !== 'recording') return state

      if (event.heldMs < MIN_RECORDING_MS) {
        return {
          ...initial,
          requestId: state.requestId,
          cancelled: true,
        }
      }

      return {
        ...state,
        phase: 'transcribing',
        heldMs: event.heldMs,
      }

    case 'ABORT':
      if (phase === 'idle') return state
      return {
        ...initial,
        requestId: state.requestId + 1,
        cancelled: true,
      }

    case 'CHUNKS':
      // Delivered by MediaRecorder.onstop, possibly after an abort or a barge-in.
      return {
        ...state,
        usable:
          !state.cancelled &&
          phase === 'transcribing' &&
          event.requestId === state.requestId,
      }

    case 'RESULT':
      if (event.requestId !== state.requestId) {
        return { ...state, stale: true }
      }

      return {
        ...initial,
        requestId: state.requestId,
      }

    case 'BLUR':
      if (phase === 'idle') return state
      return {
        ...initial,
        requestId: state.requestId + 1,
        cancelled: true,
      }

    default:
      return state
  }
}
