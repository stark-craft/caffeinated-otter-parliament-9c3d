import { useCallback, useLayoutEffect, useRef, useState } from 'react'

// A request to buy packaged milk/juice/cola needs grocery login even when the
// current panel is Food. Explicit providers and restaurant requests keep their
// existing routing. This runs after transcription; it does not alter STT.
export function withGroceryPurchaseContext(transcript, intent) {
  const text = String(transcript || '').toLowerCase()
  if (intent?.name !== 'search' || intent.slots?.providers?.length ||
    /\b(?:zomato|swiggy food|restaurant|cafe)\b/u.test(text) ||
    !/\b(?:buy|purchase|shop for)\b/u.test(text) ||
    !/\b(?:milk|juice|coca[\s-]?cola|coke)\b/u.test(text)) return intent
  return { ...intent, slots: { ...intent.slots, vertical: 'grocery' } }
}

// App owns authentication. Keep only the latest requested activity in memory;
// resuming discovery never authorizes an add-to-cart, payment or checkout.
export function useLoginContinuation({ paneOpen, ready, onResume }) {
  const [pending, setPending] = useState(null)
  const pendingRef = useRef(null)
  const clear = useCallback(() => {
    pendingRef.current = null
    setPending(null)
  }, [])
  const remember = useCallback(action => {
    pendingRef.current = action
    setPending(action)
  }, [])

  useLayoutEffect(() => {
    if (!pending || pendingRef.current !== pending) return
    if (!paneOpen) { clear(); return }
    if (!ready(pending)) return
    // Retire before dispatch, including React StrictMode's repeated effects.
    pendingRef.current = null
    setPending(null)
    onResume(pending)
  }, [pending, paneOpen, ready, onResume, clear])

  return { remember, clear }
}
