export function matchedDishLines(card, limit = 3) {
  return (card?.dishes || [])
    .slice(0, limit)
    .filter((d) => d?.name)
    .map((d) =>
      d.price != null
        ? `${d.name} · ₹${d.price}`
        : d.name,
    )
}

export function notFoundLabel(card) {
  const missing = card?.missing || []

  return missing.length
    ? `didn't find: ${missing.join(', ')}`
    : ''
}
