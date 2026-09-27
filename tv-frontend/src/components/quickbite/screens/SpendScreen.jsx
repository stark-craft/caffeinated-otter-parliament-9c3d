import PlatformBadge from '../PlatformBadge.jsx';
const rupees = (n) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";
export default function SpendScreen({
  model,
  focusKey,
  focusableProps,
  renderHeader,
}) {
  const available = model.platforms.filter((p) => p.available && p.total);
  return (
    <>
      {renderHeader("Your spend", model.caption, model.month)}
      <p className="qb-spend-total">
        {rupees(model.total)}
        <span> · {model.orderCount} orders</span>
      </p>
      <div className="qb-spend-bar">
        {available.map((p, i) => (
          <span
            key={p.platform}
            className={`qb-spend-seg qb-spend-seg-${i % 4}`}
            style={{ width: `${p.share * 100}%` }}
          />
        ))}
      </div>
      <ul className="qb-spend-legend">
        {model.platforms.map((p, i) => {
          const isAvailable = p.available && p.total;
          const colorIndex = isAvailable ? available.indexOf(p) % 4 : -1;
          const dotClass = isAvailable
            ? `qb-spend-seg-${colorIndex}`
            : "qb-spend-seg-na";
          return (
            <li
              key={p.platform}
              className={p.available ? "" : "is-unavailable"}
            >
              <i className={`qb-spend-dot ${dotClass}`} />
              <PlatformBadge platform={p.platform} compact />
              <span>
                {p.available
                  ? `${rupees(p.total)} · ${p.orders ?? 0} orders`
                  : "unavailable"}
              </span>
            </li>
          );
        })}
      </ul>
      {model.tip && <p className="qb-spend-tip">{model.tip}</p>}
      <div className="qb-answer-actions">
        {model.actions.map((label, i) => (
          <button
            key={`s-${i}`}
            className={`qb-secondary-button qb-answer-action ${focusKey === `spend-action-${i}` ? "is-focused" : ""}`}
            {...focusableProps(`spend-action-${i}`)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
