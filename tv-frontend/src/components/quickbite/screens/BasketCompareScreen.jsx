import PlatformBadge from '../PlatformBadge.jsx';
const rupees = (n) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";
export default function BasketCompareScreen({
  model,
  focusKey,
  focusableProps,
  renderHeader,
}) {
  const max = Math.max(1, ...model.platforms.map((p) => p.total || 0));
  return (
    <>
      {renderHeader(
        model.label,
        model.caption,
        `${model.commonCount} items on both`,
      )}
      <ul className="qb-bcmp-rows">
        {model.platforms.map((p, i) => (
          <li key={p.key} className={`qb-bcmp-row ${p.best ? "is-best" : ""}`}>
            <div className="qb-bcmp-head">
              <strong><PlatformBadge platform={p.name} /></strong>
              <span>{rupees(p.total)}</span>
            </div>
            <div className="qb-bcmp-bar">
              <span style={{ width: `${((p.total || 0) / max) * 100}%` }} />
            </div>
            {p.missing.length > 0 && (
              <p className="qb-bcmp-missing">Missing: {p.missing.join(", ")}</p>
            )}
            <button
              className={`${p.best ? "qb-primary-button" : "qb-secondary-button"} ${focusKey === `bcmp-fill-${i}` ? "is-focused" : ""}`}
              {...focusableProps(`bcmp-fill-${i}`)}
            >
              Fill {p.name} cart
            </button>
          </li>
        ))}
      </ul>
      {model.savings > 0 && (
        <p className="qb-compare-saving">Cheaper by {rupees(model.savings)}</p>
      )}
    </>
  );
}
