/* Raised on low confidence, a missing slot, an unresolvable reference or a
stale view revision (spec §9). The screen underneath is deliberately left
alone - the user has not asked for it to change. */
import { useLayoutEffect, useRef } from 'react';
export default function ConfirmStrip({ strip, focusIndex = 0, onPick, onFocusIndex }) {
  const dialogRef = useRef(null);
  useLayoutEffect(() => {
    if (strip) dialogRef.current?.querySelector(`[data-qb-confirm="${focusIndex}"]`)?.focus({ preventScroll: true });
  }, [strip, focusIndex]);
  if (!strip) return null;
  return (
    <div
      className="qb-confirm-strip"
      role="alertdialog"
      ref={dialogRef}
      aria-modal="true"
      aria-label={strip.question}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        onFocusIndex?.((focusIndex + (event.shiftKey ? -1 : 1) + strip.options.length) % strip.options.length);
      }}
    >
      <span className="qb-confirm-question">{strip.question}</span>
      <div className="qb-confirm-options">
        {strip.options.map((option, index) => (
          <button
            key={`${option.intent}-${option.itemId || index}`}
            type="button"
            data-qb-confirm={index}
            onFocus={() => onFocusIndex?.(index)}
            onMouseMove={() => onFocusIndex?.(index)}
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
