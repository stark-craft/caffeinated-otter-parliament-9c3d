export const BIXBY_VOICE_KEY = 'XF86BTVoice'
const BIXBY_REGISTER_KEY_NAME = 'BTVoice'

export function isBixbyVoiceKey(event) {
  return event?.key === BIXBY_VOICE_KEY
}

export function registerBixbyVoiceKey() {
  try {
    const appcommon = window.webapis?.appcommon
    if (!appcommon?.registerKey) return false
    appcommon.registerKey([BIXBY_REGISTER_KEY_NAME])
    return true
  } catch (error) {
    console.warn('Could not register Samsung Bixby key:', error)
    return false
  }
}

export function unregisterBixbyVoiceKey() {
  try {
    window.webapis?.appcommon?.unregisterKey?.([BIXBY_REGISTER_KEY_NAME])
  } catch (error) {
    console.warn('Could not unregister Samsung Bixby key:', error)
  }
}

export async function requestMicPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (error) {
    console.warn('Samsung microphone permission was not granted:', error)
    return false
  }
}
