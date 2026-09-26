const LABELS = {
  price_max: (d) =>
    d.price != null
      ? `₹${d.price} · over budget`
      : 'over budget',

  rating_min: (d) =>
    d.rating != null
      ? `${d.rating}★ · below your rating`
      : 'below your rating',

  eta_max: (d) =>
    d.eta_minutes != null
      ? `${d.eta_minutes} min · slower than asked`
      : 'slower than asked',

  veg: () =>
    'not vegetarian',

  open_now: () =>
    'closed right now',
}

/* An unknown miss name yields nothing rather than leaking a backend identifier
   onto a 10-foot screen. */

export function missLabel(card) {
  return (card?.misses || [])
    .map(
      (m) =>
        LABELS[m]?.(card),
    )
    .filter(Boolean)
    .join(' · ')
}
