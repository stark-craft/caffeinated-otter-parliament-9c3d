import { useEffect, useRef, useState } from 'react'
import { groceryLandingRequest } from './catalog.js'

// Authentication remains App-owned. Only a local browse target is held here;
// this hook never sends a chat request or constructs/generates a QR code.
export function useProductShortcut({ groceryUnlocked, paneOpen, pairingActive,
  onNavigate, onRequestLogin, onOpen }) {
  const [pending, setPending] = useState(null)
  const pendingRef = useRef(null)
  useEffect(() => {
    if (!pending) return
    if (!paneOpen || (!pairingActive && !groceryUnlocked)) {
      pendingRef.current = null
      setPending(null)
    } else if (groceryUnlocked && pendingRef.current === pending) {
      pendingRef.current = null
      setPending(null)
      onNavigate(pending)
    }
  }, [pending, paneOpen, pairingActive, groceryUnlocked, onNavigate])

  return productId => {
    const request = groceryLandingRequest(productId)
    if (!request) return
    if (groceryUnlocked) {
      pendingRef.current = null
      setPending(null)
      onNavigate(request)
      onOpen()
    } else {
      pendingRef.current = request
      setPending(request)
      onRequestLogin('grocery')
    }
  }
}
