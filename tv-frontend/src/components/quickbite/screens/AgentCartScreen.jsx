import { CART_PREVIEW } from "../../../quickbite/widgetScreens.js";
const rupees = (n) =>
  typeof n === "number"
    ? `₹${n.toLocaleString("en-IN")}`
    : "—"; /* The platform's real cart. Checkout opens the existing cart screen, where
the charge still needs its own focused OK — nothing is paid from here. */
export default function AgentCartScreen({
  model,
  focusKey,
  focusableProps,
  Media,
  renderHeader,
  expanded,
}) {
  const shown = expanded ? model.lines : model.lines.slice(0, CART_PREVIEW);
  const hidden = model.lines.length - shown.length;
  return (
    <>
      {renderHeader(
        `${model.platform} cart`,
        model.caption,
        `${model.lines.length} items`,
      )}
      <ul className="qb-cart-lines">
        {shown.map((line, i) => (
          <li
            key={`${line.name}-${i}`}
            className={`qb-cart-line ${line.in_stock ? "" : "is-out"}`}
          >
            <Media
              src={line.image_url}
              alt={line.name}
              className="qb-cart-line-img"
              fallback="🛒"
            />
            <span className="qb-cart-line-name">
              {line.name}
              {line.pack_size && (
                <em className="qb-cart-line-pack">{line.pack_size}</em>
              )}
              {!line.in_stock && (
                <em className="qb-cart-line-pack">Out of stock</em>
              )}
            </span>
            <span className="qb-cart-line-qty">×{line.quantity}</span>
            <span className="qb-cart-line-amt">
              {rupees(line.price == null ? null : line.price * line.quantity)}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          className={`qb-text-button qb-cart-more ${focusKey === "acart-more" ? "is-focused" : ""}`}
          {...focusableProps("acart-more")}
        >
          +{hidden} more
        </button>
      )}
      <div className="qb-cart-total">
        <span>{model.totalLabel}</span>
        <strong>{rupees(model.total)}</strong>
      </div>
      <div className="qb-cart-actions">
        <button
          className={`qb-primary-button ${focusKey === "acart-checkout" ? "is-focused" : ""}`}
          {...focusableProps("acart-checkout")}
        >
          Checkout
        </button>
        <button
          className={`qb-secondary-button ${focusKey === "acart-edit" ? "is-focused" : ""}`}
          {...focusableProps("acart-edit")}
        >
          Edit items
        </button>
      </div>
    </>
  );
}
