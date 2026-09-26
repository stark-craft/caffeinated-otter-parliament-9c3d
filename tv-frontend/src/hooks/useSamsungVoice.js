import { useEffect, useRef, useState } from 'react'
import {
  isBixbyVoiceKey, registerBixbyVoiceKey, requestMicPermission,
  unregisterBixbyVoiceKey,
} from '../tizen/bixbyVoice.js'
import { VOICE_COMMANDS, getHiddenVoiceTargets, normalizeVoicePhrase } from '../quickbite/voiceNavigation.js'
import { newVoiceTrace, voiceError, voiceLog, voiceWarn } from '../quickbite/voiceDiagnostics.js'

const samsungTargets = getHiddenVoiceTargets()

export function buildSamsungContentContext(voiceInteraction) {
  const items = VOICE_COMMANDS.map((entry, index) => {
    const title = entry.aliases[0]
    const aliases = [...new Set([
      ...entry.aliases.slice(1),
      ...samsungTargets.filter((target) => target.command === entry.command)
        .slice(0, 20).map((target) => target.label),
    ])].filter((alias) => alias !== title)
    try {
      return voiceInteraction.buildVoiceInteractionContentContextItem?.(
        index % 4, Math.floor(index / 4), title, aliases, false,
      ) || { positionX: index % 4, positionY: Math.floor(index / 4), title, alias: aliases, bFocused: false }
    } catch {
      return { positionX: index % 4, positionY: Math.floor(index / 4), title, alias: aliases, bFocused: false }
    }
  })
  try {
    return voiceInteraction.buildVoiceInteractionContentContextResponse?.(items) || JSON.stringify(items)
  } catch {
    return JSON.stringify(items)
  }
}

function loadSamsungWebapis() {
  if (window.webapis || !window.tizen) {
    voiceLog(null, 'Samsung webapis bootstrap skipped', { tizen: Boolean(window.tizen), webapis: Boolean(window.webapis) })
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = '$WEBAPIS/webapis/webapis.js'
    script.onload = () => { voiceLog(null, 'Samsung webapis script loaded', { webapis: Boolean(window.webapis) }); resolve() }
    script.onerror = () => { voiceWarn(null, 'Samsung webapis script failed to load', { src: script.src }); resolve() }
    document.head.appendChild(script)
  })
}

// This is the sole owner of XF86BTVoice. VideoPlayer must not register a
// second listener or call QuickShop's placeholder startTvVoiceRecognition().
export function useSamsungVoice({ onTranscript }) {
  const callbackRef = useRef(onTranscript)
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [micError, setMicError] = useState('')
  callbackRef.current = onTranscript

  useEffect(() => {
    let alive = true
    let recognition = null
    let starting = false
    let safetyTimer = 0
    let messageTimer = 0
    let lastResult = { text: '', at: 0 }
    let activeTraceId = null
    voiceLog(null, 'Samsung voice adapter mounted', {
      tizen: Boolean(window.tizen), webapis: Boolean(window.webapis),
      speechRecognition: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    })
    const clearSafety = () => { window.clearTimeout(safetyTimer); safetyTimer = 0 }
    const showError = (message) => {
      if (!alive) return
      voiceWarn(activeTraceId, 'Samsung voice error shown to user', { message })
      setPhase('idle')
      setMicError(message)
      window.clearTimeout(messageTimer)
      messageTimer = window.setTimeout(() => setMicError(''), 6000)
    }
    const deliver = async (value, source = 'samsung-stt', traceId = activeTraceId || newVoiceTrace(source)) => {
      const text = String(value || '').trim()
      if (!text || !alive) {
        voiceWarn(traceId, 'Samsung empty or late transcript discarded', { text, alive })
        return
      }
      const normalized = normalizeVoicePhrase(text)
      if (normalized === lastResult.text && Date.now() - lastResult.at < 1800) {
        voiceLog(traceId, 'Duplicate Samsung transcript suppressed', { transcript: text, normalized })
        return
      }
      lastResult = { text: normalized, at: Date.now() }
      setTranscript(text)
      setPhase('transcribing')
      voiceLog(traceId, 'Samsung transcript → CommAgent handleTranscript', { transcript: text, normalized, source, language: 'en-IN' })
      try {
        await callbackRef.current?.(text, 'en-IN', source, traceId)
        voiceLog(traceId, 'CommAgent transcript handler completed', { source })
      } catch (error) {
        voiceError(traceId, 'CommAgent transcript handler failed', error)
        showError(error?.message || 'Could not process that voice command.')
      } finally {
        if (alive) setPhase('idle')
      }
    }
    const startRecognition = () => {
      if (starting || recognition) {
        voiceLog(activeTraceId, 'Samsung recognition already active; repeat ignored', { starting, recognition: Boolean(recognition) })
        return
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        voiceWarn(activeTraceId, 'Samsung SpeechRecognition constructor unavailable', { tizen: Boolean(window.tizen), webapis: Boolean(window.webapis) })
        showError('Speech recognition is unavailable on this TV.')
        return
      }
      const current = new SpeechRecognition()
      let heardFinal = false
      recognition = current
      starting = true
      current.lang = 'en-IN'
      current.continuous = false
      current.interimResults = true
      current.maxAlternatives = 1
      current.onstart = () => {
        voiceLog(activeTraceId, 'Samsung microphone/listening started', { language: current.lang })
        if (alive) setPhase('recording')
      }
      current.onresult = (event) => {
        let finalText = ''
        let interimText = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = event.results[index][0]?.transcript || ''
          if (event.results[index].isFinal) finalText += `${text} `
          else interimText += `${text} `
        }
        if (finalText.trim()) {
          heardFinal = true
          voiceLog(activeTraceId, 'Samsung final speech recognition result', { transcript: finalText.trim(), resultIndex: event.resultIndex })
          deliver(finalText)
        } else if (interimText.trim() && alive) {
          voiceLog(activeTraceId, 'Samsung interim speech recognition result', { transcript: interimText.trim() })
          setTranscript(interimText.trim())
        } else {
          voiceWarn(activeTraceId, 'Samsung speech result contained no transcript', { resultIndex: event.resultIndex })
        }
      }
      current.onerror = (event) => {
        voiceWarn(activeTraceId, 'Samsung speech recognition event error', { error: event.error || 'unknown' })
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          showError(`Could not listen: ${event.error || 'microphone error'}.`)
        }
      }
      current.onend = () => {
        voiceLog(activeTraceId, 'Samsung listening ended', { starting, alive, heardFinal })
        if (!heardFinal) voiceWarn(activeTraceId, 'Samsung listening ended without a final STT transcript', { language: current.lang })
        clearSafety()
        recognition = null
        starting = false
        if (alive) setPhase((value) => value === 'transcribing' ? value : 'idle')
      }
      setMicError('')
      setTranscript('')
      setPhase('acquiring')
      try {
        voiceLog(activeTraceId, 'Samsung recognition.start() called', { language: current.lang, interimResults: current.interimResults })
        current.start()
        safetyTimer = window.setTimeout(() => {
          voiceWarn(activeTraceId, 'Samsung listening safety timeout; aborting recognition', { timeoutMs: 10000 })
          current.abort()
        }, 10000)
      } catch (error) {
        voiceError(activeTraceId, 'Samsung recognition.start() failed', error)
        recognition = null
        starting = false
        showError(error.message || 'Could not start voice recognition.')
      }
    }
    const onKeyDown = (event) => {
      if (!isBixbyVoiceKey(event)) return
      if (!event.repeat && !starting && !recognition) activeTraceId = newVoiceTrace('samsung-stt')
      voiceLog(activeTraceId, 'Samsung XF86BTVoice keydown', { key: event.key, repeat: event.repeat })
      if (!event.repeat) startRecognition()
    }
    const onKeyUp = (event) => {
      if (!isBixbyVoiceKey(event)) return
      voiceLog(activeTraceId, 'Samsung XF86BTVoice keyup; waiting for final result', { key: event.key })
      // Do not stop() on release: QuickShop's Samsung path lets the final
      // SpeechRecognition result complete naturally after the button lifts.
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)

    loadSamsungWebapis().then(() => {
      if (!alive) return
      const registered = registerBixbyVoiceKey()
      voiceLog(null, 'Samsung BTVoice key registration', { registered, appcommon: Boolean(window.webapis?.appcommon) })
      if (registered) requestMicPermission().then((granted) => {
        if (alive) voiceLog(null, 'Samsung microphone preflight result', { granted })
      })
      const interaction = window.webapis?.voiceinteraction
      if (!interaction?.setCallback) {
        voiceWarn(null, 'Samsung VoiceInteraction callback API unavailable', { voiceinteraction: Boolean(interaction) })
        return
      }
      try {
        interaction.setCallback({
          onrequestcontentcontext: () => {
            voiceLog(null, 'Samsung VoiceInteraction requested navigation context', { commands: VOICE_COMMANDS.length, hiddenTargets: samsungTargets.length })
            return buildSamsungContentContext(interaction)
          },
          ontitleselection: (title) => {
            const traceId = newVoiceTrace('samsung-title')
            voiceLog(traceId, 'Samsung VoiceInteraction selected title', { title })
            deliver(title, 'samsung-title-selection', traceId)
            return true
          },
          onupdatestate: () => { voiceLog(null, 'Samsung VoiceInteraction requested app state', { state: 'List' }); return 'List' },
          onchangeappstate: () => { voiceLog(null, 'Samsung VoiceInteraction app state changed', { accepted: true }); return true },
        })
        voiceLog(null, 'Samsung VoiceInteraction callback registered', { commands: VOICE_COMMANDS.length })
        interaction.listen?.()
        voiceLog(null, 'Samsung VoiceInteraction listen() called', { available: Boolean(interaction.listen) })
      } catch (error) {
        voiceError(null, 'Samsung VoiceInteraction setup failed', error)
        console.warn('Samsung VoiceInteraction could not start:', error)
      }
    })

    return () => {
      voiceLog(activeTraceId, 'Samsung voice adapter unmounted', { recognitionActive: Boolean(recognition) })
      alive = false
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      clearSafety()
      window.clearTimeout(messageTimer)
      recognition?.abort()
      unregisterBixbyVoiceKey()
    }
  }, [])

  return { phase, transcript, micError }
}
