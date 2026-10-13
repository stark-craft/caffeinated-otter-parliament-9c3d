import { CART_PREVIEW } from "../../../quickbite/widgetScreens.js";
import PlatformBadge from '../PlatformBadge.jsx';
import { agentCartDisplayTotal } from '../../../quickbite/agentCart.js';
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
  const lines = Array.isArray(model?.lines) ? model.lines : [];
  const shown = expanded || model?.editable ? lines : lines.slice(0, CART_PREVIEW);
  const hidden = lines.length - shown.length;
  return (
    <>
      {renderHeader(
        model?.editable ? 'Review Cart' : `${model?.platform || ''} cart`,
        model?.caption,
        `${lines.length} items`,
      )}
      <PlatformBadge platform={model?.platform} />
      {!lines.length && <p>{model?.dirty ? 'All rows removed from this draft. Select Review Cart to apply changes to the provider.' : 'Your cart is empty.'}</p>}
      {model?.unavailable > 0 && <p className="qb-cart-line-pack">{model.unavailable} unavailable items excluded.</p>}
      <ul className={`qb-cart-lines ${model?.editable ? 'qb-cart-editor' : ''}`}>
        {shown.map((line, i) => (
          <li
            key={`${line.name}-${i}`}
            className={`qb-cart-line ${line.in_stock ? "" : "is-out"} ${focusKey === `acart-minus-${i}` || focusKey === `acart-plus-${i}` ? 'has-active-control' : ''} ${!model?.editable && focusKey === `acart-item-${i}` ? 'is-focused' : ''}`}
            {...(!model?.editable ? focusableProps(`acart-item-${i}`) : {})}
          >
            <Media
              src={line.image_url}
              alt={line.name}
              className="qb-cart-line-img"
              fallback="🛒"
            />
            <span className="qb-cart-line-name">
              {!model?.editable && <PlatformBadge platform={model.platform} compact />}
              {line.name}
              {line.pack_size && (
                <em className="qb-cart-line-pack">{line.pack_size}</em>
              )}
              {model?.editable && line.price != null && <em className="qb-cart-line-pack">{rupees(line.price)} each</em>}
              {!line.in_stock && (
                <em className="qb-cart-line-pack">Out of stock</em>
              )}
            </span>
            {model?.editable ? <span className="qb-quantity-controls qb-cart-quantity">
              <button type="button" aria-label={`Decrease ${line.name} quantity; zero removes this item from the draft`}
                className={focusKey === `acart-minus-${i}` ? 'is-focused' : ''} {...focusableProps(`acart-minus-${i}`)}>−</button>
              <strong aria-label={`${line.name} quantity`}>{line.quantity}</strong>
              <button type="button" aria-label={`Increase ${line.name} quantity`}
                className={focusKey === `acart-plus-${i}` ? 'is-focused' : ''} {...focusableProps(`acart-plus-${i}`)}>+</button>
            </span> : <span className="qb-cart-line-qty">×{line.quantity}</span>}
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
        <span>{model?.dirty ? 'Estimated item subtotal' : model?.totalLabel}</span>
        <strong>{rupees(agentCartDisplayTotal(model))}</strong>
      </div>
      <div className="qb-cart-actions">
        {(lines.length || model?.dirty) ? <button
          className={`qb-primary-button ${focusKey === "acart-checkout" ? "is-focused" : ""}`}
          {...focusableProps("acart-checkout")}
        >
          {model?.dirty ? 'Review Cart' : 'Checkout'}
        </button> : <button className={`qb-primary-button ${focusKey === 'shop-more' ? 'is-focused' : ''}`} {...focusableProps('shop-more')}>Shop More</button>}
        {!model?.editable && lines.length > 0 && <button
          className={`qb-secondary-button ${focusKey === "acart-edit" ? "is-focused" : ""}`}
          {...focusableProps("acart-edit")}
        >
          Edit items
        </button>}
        {(lines.length > 0 || model?.dirty) && <button type="button"
          className={`qb-secondary-button ${focusKey === "acart-clear" ? "is-focused" : ""}`}
          {...focusableProps("acart-clear")}>
          Clear Cart
        </button>}
      </div>
    </>
  );
}
