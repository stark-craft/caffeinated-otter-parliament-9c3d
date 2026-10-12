import { useEffect, useRef, useState } from 'react'
// Self-contained request builder; existing QR/pending-target logic is retained.
function groceryShortcutRequest(productId) {
  return ['milk', 'cola'].includes(productId) ? { type: 'grocery-shortcut', productId } : null
}

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
