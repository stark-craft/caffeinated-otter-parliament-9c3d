import { providerId, PROVIDERS } from './providers.js';
const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
function firstArray(...values) {
  return values.find(Array.isArray) || [];
} /* A card image goes straight into an <img src>. The backend validates the
`image_url` it produces, but these mappers also fall back to `image` and
`thumbnail`, which nothing checks — so the check lives where the value is
read. Anything that is not http(s) becomes the emoji placeholder. */
export function safeImageUrl(...candidates) {
  for (const candidate of candidates) {
    const url = String(candidate || "").trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return "";
}
export function imageDataUri(image) {
  if (!image) return "";
  if (typeof image === "string") {
    const value = image.trim();
    if (/^(data:|https?:|blob:|\/)/i.test(value)) return value;
    if (value.length > 128 && /^[a-z0-9+/=\s]+$/i.test(value))
      return `data:image/png;base64,${value}`;
    return value;
  }
  if (image.url || image.src || image.image_url)
    return image.url || image.src || image.image_url;
  if (!image.data) return "";
  if (String(image.data).startsWith("data:")) return image.data;
  const mime =
    image.mime || image.mime_type || image.content_type || "image/png";
  return `data:${mime};base64,${image.data}`;
}
export function trackingFromEnvelope(envelope) {
  const direct = asObject(envelope?.tracking);
  if (Object.keys(direct).length) return direct;
  const nested = asObject(asObject(envelope?.payload).tracking);
  return Object.keys(nested).length ? nested : null;
}
export function paymentQrFromEnvelope(envelope, { allowImageFallback = true } = {}) {
  const payload = asObject(envelope?.payload);
  const tracking = asObject(trackingFromEnvelope(envelope));
  const explicit =
    envelope?.payment_qr || envelope?.qr || envelope?.qr_code ||
    payload.payment_qr || payload.qr || payload.qr_code ||
    tracking.payment_qr || tracking.qr || tracking.qr_code;
  const direct = imageDataUri(explicit);
  if (direct) return direct;
  if (!allowImageFallback) return "";
  const images = asArray(envelope?.images);
  return imageDataUri(images[images.length - 1]);
}
function unwrapPayload(envelope) {
  const payload = asObject(envelope?.payload);
  return Object.keys(payload).length ? payload : asObject(envelope);
}
export function restaurantCardsFromEnvelope(envelope) {
  const payload = unwrapPayload(envelope);
  const data = asObject(payload.data);
  const cards = firstArray(
    payload.cards,
    payload.restaurants,
    payload.results,
    payload.items,
    data.cards,
    data.restaurants,
    data.results,
    envelope?.cards,
  );
  return (
    cards
      // `entry.restaurant` here means "this entry wraps a nested restaurant
      // object", e.g. { restaurant: { name, rating } }. A dish card's
      // `restaurant` is a plain string (the restaurant's name) and must not be
      // mistaken for that wrapper, or asObject() on the string collapses it to
      // {} and the card silently disappears.
      .map((entry) =>
        asObject(
          entry.card ||
            (typeof entry.restaurant === "object" ? entry.restaurant : null) ||
            entry,
        ),
      )
      .filter(
        (card) =>
          (card.name || card.restaurant_name) && card.kind !== "grocery",
      )
      .map((card) => ({
        ...card,
        name: card.name || card.restaurant_name,
        image_url: safeImageUrl(card.image_url, card.image, card.thumbnail),
        /* Never invent a platform: the card renders this as a badge, so a
default of 'Zomato' labelled unbadged Swiggy cards as Zomato. An
unbadged card is a backend gap worth seeing. Same rule as
groceryCardsFromEnvelope below. */
        platform: card.platform || payload.platform || "",
      }))
  );
} /* Grocery results from compare_grocery. The backend has already ranked these
cheapest-first with out-of-stock last (core/tool_registry.py `_compare_grocery`)
and stamped `best` per unit price, so this never re-sorts and never invents a
platform — an unbadged card is a backend bug worth seeing, not worth hiding. */
export function groceryCardsFromEnvelope(envelope) {
  const payload = unwrapPayload(envelope);
  const data = asObject(payload.data);
  const kind = payload.kind || data.kind;
  if (kind && kind !== "grocery") return [];
  const cards = firstArray(
    payload.cards,
    payload.products,
    data.cards,
    data.products,
    envelope?.cards,
  );
  return cards
    .map((entry) => asObject(entry.card || entry.product || entry))
    .filter((card) => card.name && card.kind !== "food")
    .map((card) => ({
      ...card,
      name: card.name,
      platform: ['swiggy_instamart', 'zepto'].includes(providerId(card.platform, 'grocery'))
        ? PROVIDERS[providerId(card.platform, 'grocery')].label : card.platform || "",
      pack_size: card.pack_size || card.quantity_description || "",
      image_url: safeImageUrl(card.image_url, card.image, card.thumbnail),
      best: Boolean(card.best),
    }));
}
export function menuFromEnvelope(envelope) {
  const payload = unwrapPayload(envelope);
  const data = asObject(payload.data);
  const menuObject = asObject(payload.menu);
  const dataMenuObject = asObject(data.menu);
  const items = firstArray(
    payload.items,
    payload.menu,
    payload.dishes,
    menuObject.items,
    menuObject.dishes,
    data.items,
    data.menu,
    data.dishes,
    dataMenuObject.items,
  )
    .map((entry) => asObject(entry.item || entry))
    .filter((item) => item.name)
    .map((item) => ({
      ...item,
      image_url: safeImageUrl(item.image_url, item.image, item.thumbnail),
      variants: asArray(item.variants).map((variant) =>
        typeof variant === "string" ? { label: variant } : asObject(variant),
      ),
    }));
  return {
    ...payload,
    restaurant:
      payload.restaurant || payload.restaurant_name || data.restaurant || "",
    /* Never invent a platform, for the same reason as the two mappers above -
and with sharper teeth here: this value reaches orderPlatform() and
decides whether the TV shows a UPI QR. Defaulting to Zomato let a Swiggy
menu render a QR nothing can pay. */
    platform: payload.platform || data.platform || "",
    rating: payload.rating ?? data.rating,
    eta: payload.eta || data.eta || "",
    items,
  };
}
export function chooseMenuItem(items, desiredName) {
  if (!items?.length) return null;
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const desired = normalize(desiredName);
  return (
    items.find((item) => normalize(item.name).includes(desired)) || items[0]
  );
}
export function cartFromEnvelope(envelope) {
  const payload = unwrapPayload(envelope);
  const data = asObject(payload.data);
  const nestedCart = asObject(payload.cart);
  const source = Object.keys(nestedCart).length
    ? { ...payload, ...nestedCart }
    : Object.keys(data).length && !payload.items
      ? { ...payload, ...data }
      : payload;
  const items = firstArray(source.items, source.cart_items, source.lines)
    .map((entry) => asObject(entry.item || entry))
    .filter((item) => item.name || item.item_name)
    .map((item) => ({
      ...item,
      name: item.name || item.item_name,
      quantity: Number(item.quantity ?? item.qty ?? item.count ?? 1),
      image_url: safeImageUrl(item.image_url, item.image, item.thumbnail),
    }));
  const looksLikeCart =
    envelope?.widget === "cart" || items.length > 0 || source.total != null;
  if (!looksLikeCart) return null;
  const grocery = source.kind === 'grocery' ||
    ['swiggy_instamart', 'zepto'].includes(providerId(source.platform)) ||
    providerId(envelope?.vendor_widget?.server) === 'swiggy_instamart';
  const platformId = providerId(source.platform || envelope?.vendor_widget?.server, grocery ? 'grocery' : 'food');
  return {
    ...source,
    platform: grocery && platformId ? PROVIDERS[platformId].label : source.platform || '',
    // A grocery cart is labelled with a store, not a restaurant. show_cart
    // already copies one into the other, but a raw platform cart may carry
    // only `store`.
    restaurant:
      source.restaurant || source.restaurant_name || source.store || "",
    items,
    delivery: source.delivery ?? source.delivery_fee,
    taxes: source.taxes ?? source.tax ?? source.charges,
    total: source.total ?? source.grand_total,
    subtotal: source.subtotal ?? source.sub_total ?? source.item_total,
    discount: source.discount ?? source.discount_amount,
    other_charges: source.other_charges,
    eta: source.eta || source.delivery_eta || "",
    address: source.address || source.delivery_address || "",
    payment: source.payment || source.payment_method || "",
  };
}
export function numericMoney(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return normalized ? Number(normalized[0]) : null;
}
export function money(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    const nested = value.amount ?? value.total ?? value.value;
    return nested == null ? "" : money(nested);
  }
  if (typeof value === "string" && /[₹$€£]/.test(value)) return value;
  const number = numericMoney(value);
  if (number == null) return String(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(number) ? 0 : 2,
  }).format(number);
}
export function safeSubtotal(cart) {
  if (cart?.subtotal != null) return cart.subtotal;
  const lines = asArray(cart?.items).map((item) => {
    const lineTotal = numericMoney(item.total ?? item.line_total);
    if (lineTotal != null) return { line: lineTotal, asWritten: lineTotal };
    const price = numericMoney(item.price ?? item.offer_price);
    const quantity = Number(item.quantity ?? item.qty ?? 1);
    if (price == null || !Number.isFinite(quantity)) return null;
    return { line: price * quantity, asWritten: price };
  });
  if (!lines.length || lines.some((entry) => entry == null)) return null;
  const multiplied = lines.reduce((sum, entry) => sum + entry.line, 0);
  // `price` is the line total on a show_cart payload and the unit price on a
  // raw platform cart, and nothing in the payload says which. The bill settles
  // it: a subtotal above the total payable, with no discount to account for the
  // gap, means the line was already totalled and multiplying it out again is
  // what put "Subtotal 3,500" over "Total 881.31" on the cart screen.
  const total = numericMoney(cart?.total);
  const discount = numericMoney(cart?.discount) ?? 0;
  if (total != null && multiplied > total + discount) {
    return lines.reduce((sum, entry) => sum + entry.asWritten, 0);
  }
  return multiplied;
}
export function platformEntries(platforms) {
  if (Array.isArray(platforms)) return platforms;
  if (!platforms || typeof platforms !== "object") return [];
  return Object.entries(platforms).map(([name, value]) =>
    typeof value === "object"
      ? { name, ...value }
      : { name, connected: Boolean(value) },
  );
}
export function platformConnection(platforms, provider) {
  const normalized = provider.toLowerCase();
  const entry = platformEntries(platforms).find((item) =>
    String(item.name || item.id || item.group || item.platform || "")
      .toLowerCase()
      .includes(normalized),
  );
  if (!entry) return { known: false, connected: true };
  const explicit =
    entry.connected ??
    entry.authenticated ??
    entry.authorized ??
    entry.is_connected;
  return {
    known: true,
    connected: explicit == null ? true : Boolean(explicit),
    entry,
  };
} /* One basket line, kept or cut. Both arrays carry the same shape, so the
screen renders them with the same row component. */
const basketLine = (l) => ({
  query: String(l.query),
  requested: l.requested || "",
  name: l.name || "",
  pack_size: l.pack_size || "",
  note: l.note || "",
  count: Number(l.count) || 0,
  line_total: l.line_total ?? null,
  price: l.price ?? null,
  mrp: l.mrp ?? null,
  image_url: safeImageUrl(l.image_url, l.image, l.thumbnail),
  status: l.status || "unavailable",
  priority: l.priority || "essential",
}); /* A stocked basket: what actually went into the cart, line by line.
Unlike the card extractors this one does no shape-sniffing — the payload
comes from our own stock_basket tool, not a vendor, so its shape is fixed.
Guard only against the envelope being something else entirely. */
export function basketStockedFromEnvelope(envelope) {
  if (envelope?.widget !== "basket_stocked") {
    return {
      platform: "",
      label: "",
      lines: [],
      cut: [],
      total: 0,
      stocked: 0,
      unavailable: 0,
      budget: null,
      over_by: 0,
      under_by: 0,
      fits: true,
    };
  }
  const payload = unwrapPayload(envelope);
  return {
    platform: payload.platform || "",
    label: payload.label || "Basket",
    total: Number(payload.total) || 0,
    stocked: Number(payload.stocked) || 0,
    unavailable: Number(payload.unavailable) || 0,
    budget: payload.budget ?? null,
    over_by: Number(payload.over_by) || 0,
    under_by: Number(payload.under_by) || 0,
    fits: payload.fits !== false,
    lines: asArray(payload.lines)
      .map((l) => asObject(l))
      .filter((l) => l.query)
      .map(basketLine),
    cut: asArray(payload.cut)
      .map((l) => asObject(l))
      .filter((l) => l.query)
      .map(basketLine),
  };
}
