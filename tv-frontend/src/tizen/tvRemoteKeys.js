// Samsung TV sends the mandatory navigation keys as ordinary DOM key events.
// Some Tizen WebViews leave event.key empty, so retain their documented codes.
const KEY_BY_CODE = {
  13: 'Enter',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  10009: 'Backspace',
  10252: 'MediaPlayPause',
  415: 'MediaPlay',
  19: 'MediaPause',
  413: 'MediaStop',
  412: 'MediaRewind',
  417: 'MediaFastForward',
}

export function tvRemoteKey(event) {
  const code = event.keyCode || event.which
  if (code === 10009) return 'Backspace'
  if (KEY_BY_CODE[code] && (!event.key || event.key === 'Unidentified')) {
    return KEY_BY_CODE[code]
  }
  if (event.key === 'OK' || event.key === 'Select') return 'Enter'
  if (event.key === 'Return' || event.key === 'BrowserBack') return 'Backspace'
  return event.key || KEY_BY_CODE[code] || ''
}

export function registerTvMediaKeys() {
  const input = globalThis.tizen?.tvinputdevice
  if (!input?.registerKey) return
  for (const key of ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward']) {
    try {
      input.registerKey(key)
    } catch (error) {
      console.warn(`[TV remote] Could not register ${key}:`, error)
    }
  }
}
