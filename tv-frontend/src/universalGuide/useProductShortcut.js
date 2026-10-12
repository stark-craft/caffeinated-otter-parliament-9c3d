import { useEffect, useRef, useState } from 'react'
import { groceryShortcutRequest } from '../quickbite/groceryShortcut.js'

// Authentication remains App-owned. Hold the banner request until Grocery
// unlocks; the existing panel then searches and opens quantity review.
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
    const request = groceryShortcutRequest(productId)
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
