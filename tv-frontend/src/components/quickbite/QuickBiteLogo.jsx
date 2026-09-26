export default function QuickBiteLogo({ onSettings }) {
  const content = (
    <span className="qb-logo-text" aria-label="QuickBite">
      <span>Quick</span>
      <span className="qb-logo-bite">Bite</span>
    </span>
  );
  if (!onSettings) return <div className="qb-logo">{content}</div>;
  return (
    <button
      className="qb-logo qb-logo-button"
      onClick={onSettings}
      aria-label="Open connections and settings"
    >
      {content}
    </button>
  );
}
