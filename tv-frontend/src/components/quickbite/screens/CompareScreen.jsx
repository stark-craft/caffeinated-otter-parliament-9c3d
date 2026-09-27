import PlatformBadge from '../PlatformBadge.jsx';
const rupees = (n) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";
export default function CompareScreen({
  model,
  focusKey,
  focusableProps,
  Media,
  renderHeader,
}) {
  const best = model.entries.find((e) => e.best);
  return (
    <>
      {renderHeader(
        model.query ? `Best price for ${model.query}` : "Compare",
        model.caption,
      )}
      {best && model.savings > 0 && (
        <p className="qb-compare-saving">
          {best.platform} saves you {rupees(model.savings)}
        </p>
      )}
      <div className="qb-compare-grid">
        {model.entries.map((e, i) => (
          <div
            key={e.platform}
            className={`qb-compare-card ${e.best ? "is-best" : ""}`}
          >
            {e.best && <span className="qb-compare-ribbon">Best</span>}
            <Media
              src={e.image_url}
              alt={e.name}
              className="qb-compare-img"
              fallback="🛒"
            />
            <PlatformBadge platform={e.platform} compact />
            <p className="qb-compare-name">
              {e.name}
              {e.pack_size ? ` · ${e.pack_size}` : ""}
            </p>
            <p className="qb-compare-price">{rupees(e.price)}</p>
            <button
              className={`qb-primary-button ${focusKey === `cmp-order-${i}` ? "is-focused" : ""}`}
              {...focusableProps(`cmp-order-${i}`)}
            >
              Order on {e.platform}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
