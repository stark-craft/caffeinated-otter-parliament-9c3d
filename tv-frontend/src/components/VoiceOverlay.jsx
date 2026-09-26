/* The listening band (spec §8.4). The measured STT leg is 335-438ms plus
   upload, long enough that a silent control reads as broken, so `transcribing`
   is a visible state and not an internal one. */
const LABEL = { acquiring: 'Starting…', recording: 'Listening…', transcribing: 'Thinking…' }

export default function VoiceOverlay({ phase = 'idle', transcript = '', scripted = '', micError = '' }) {
  /* The hold-to-talk key could not listen. Saying so is the whole point: the
     key silently doing something else is what made a search appear for words
     the user never spoke. */
  if (phase === 'idle' && micError) {
    return (
      <div className="qb-voice-overlay is-scripted" role="status" aria-live="polite">
        <span className="qb-voice-dot" aria-hidden="true" />
        <span className="qb-voice-label">Couldn’t listen</span>
        <span className="qb-voice-text">{micError}</span>
      </div>
    )
  }

  /* No microphone on this origin, so a canned demo line was submitted. It runs
     with the machine already idle, so without this branch the overlay stayed
     hidden and the search appeared out of nowhere - "why biryani? I never said
     biryani". Say plainly that the app supplied the words. */
  if (phase === 'idle' && scripted) {
    return (
      <div className="qb-voice-overlay is-scripted" role="status" aria-live="polite">
        <span className="qb-voice-dot" aria-hidden="true" />
        <span className="qb-voice-label">No microphone — demo line</span>
        <span className="qb-voice-text">“{scripted}”</span>
      </div>
    )
  }

  if (phase === 'idle') return null
  return (
    <div className={`qb-voice-overlay is-${phase}`} role="status" aria-live="polite">
      <span className="qb-voice-dot" aria-hidden="true" />
      <span className="qb-voice-label">{LABEL[phase] || 'Listening…'}</span>
      {transcript ? <span className="qb-voice-text">{transcript}</span> : null}
    </div>
  )
}
