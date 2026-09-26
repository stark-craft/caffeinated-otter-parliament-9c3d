/* Raised on low confidence, a missing slot, an unresolvable reference or a
stale view revision (spec §9). The screen underneath is deliberately left
alone - the user has not asked for it to change. */
export default function ConfirmStrip({ strip, focusIndex = 0, onPick }) {
  if (!strip) return null;
  return (
    <div
      className="qb-confirm-strip"
      role="alertdialog"
      aria-label={strip.question}
    >
      <span className="qb-confirm-question">{strip.question}</span>
      <div className="qb-confirm-options">
        {strip.options.map((option, index) => (
          <button
            key={`${option.intent}-${option.itemId || index}`}
            type="button"
            className={`qb-confirm-chip ${index === focusIndex ? "is-focused" : ""}`}
            onClick={() => onPick?.(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
