/* Widget kind -> TV screen. One pure table, so "what does this response look
like on the TV" has one answer. It replaces an if/else chain in
QuickBitePanel whose last branch sent every unrecognised envelope to the
restaurant screen: a grocery cart rendered as "Choose a Restaurant".
Rule: an unknown kind, or a mapper that finds nothing to show, becomes the
text screen. Nothing falls through to `restaurant`. */
import {
  groceryCardsFromEnvelope,
  menuFromEnvelope,
  restaurantCardsFromEnvelope,
} from "./envelopes.js";
import { normalizeAgentCart } from './agentCart.js';
import { providerId, PROVIDERS } from './providers.js';
export const NEW_SCREENS = [
  "text",
  "agent-cart",
  "compare",
  "basket-compare",
  "spend",
];
export const CART_PREVIEW = 5;
const PLATFORM_NAMES = { instamart: "Swiggy Instamart", zepto: "Zepto" };
const asArray = (v) => (Array.isArray(v) ? v : []);
const asObject = (v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? v
    : {}; /* Defensive only: the backend sends TV sessions `text`, never `message`.
If one slips through, show its first real line, not markdown. */
export function plainCaption(text) {
  const line = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !l.startsWith("|") &&
        !l.startsWith("#") &&
        /[\p{L}\p{N}]/u.test(l),
    );
  return (line || "").replace(/\*\*|__|`/g, "").trim();
} /* Labels that place, confirm or pay for an order. The agent's own prompt
offers `[[CHOICES: Yes, place the order | No, cancel]]`; sent from the text
or spend screen, that sentence could create the order with no bill shown.
The panel routes these to the platform cart instead (see activate()). */
const ORDER_ACTION_RES = [
  /\b(place|confirm)\b[^.]*\border\b/i,
  /\bcheck\s?out\b/i,
  /\bpay\b/i,
  /\bbuy now\b/i,
  /\border now\b/i,
];
export function isOrderAction(label) {
  const text = String(label || "");
  return ORDER_ACTION_RES.some((re) => re.test(text));
}
export function isCartDestructiveAction(label) {
  return /^(?:clear|cancel) (?:my |the )?cart[.!]?$/i.test(String(label || '').trim());
}
export function isCheckoutDeclineAction(label) {
  return /^(?:no[,\s]+)?cancel(?: it)?[.!]?$/i.test(String(label || '').trim());
}
const MENTIONED_RE = /\b(swiggy instamart|instamart|zepto|swiggy|zomato)\b/i;
const MENTIONED_NAMES = {
  "swiggy instamart": "Swiggy Instamart",
  instamart: "Swiggy Instamart",
  zepto: "Zepto",
  swiggy: "Swiggy",
  zomato: "Zomato",
}; /* The first platform a text/spend model names (title, then bullets, then
caption), so an order button can open that platform's cart. null if none. */
export function platformMentioned(model) {
  const m = asObject(model);
  const text = [m.title, ...asArray(m.bullets), m.caption]
    .filter(Boolean)
    .join("\n");
  const hit = text.match(MENTIONED_RE);
  return hit ? MENTIONED_NAMES[hit[1].toLowerCase()] : null;
}
function actionsFromEnvelope(envelope) {
  const topLevel = asArray(envelope?.actions);
  return topLevel.length ? topLevel : asArray(asObject(envelope?.payload).actions);
}
function textFallback(envelope, retry = true) {
  return {
    overline: "QuickBite",
    title: plainCaption(envelope?.text) || "Nothing to show yet.",
    bullets: [],
    actions: actionsFromEnvelope(envelope),
    retry,
  };
}
function textModel(envelope) {
  const p = asObject(envelope?.payload);
  if (!p.title) {
    return plainCaption(envelope?.text) ? textFallback(envelope, false) : null;
  }
  return {
    overline: p.overline || "QuickBite",
    title: p.title,
    bullets: asArray(p.bullets),
    actions: actionsFromEnvelope(envelope),
    retry: false,
  };
}
function agentCartModel(envelope) {
  const model = normalizeAgentCart(envelope);
  return model ? { ...model, caption: plainCaption(envelope?.text) } : null;
}

// "1 L" == "1l", "500 ml" == "500ml": the same pack written two ways.
const packKey = (size) =>
  String(size || "")
    .toLowerCase()
    .replace(/\s+/g, "");
function compareModel(envelope) {
  const p = asObject(envelope?.payload);
  const grocery = p.kind !== 'food' && (p.kind === 'grocery' || asArray(p.cards).some(card =>
    ['swiggy_instamart', 'zepto'].includes(providerId(card?.platform))));
  const cheapest = new Map();
  for (const original of asArray(p.cards).map(asObject)) {
    const id = providerId(original.platform, grocery ? 'grocery' : 'food');
    const card = { ...original, platform: ['swiggy_instamart', 'zepto'].includes(id) ? PROVIDERS[id].label : original.platform };
    if (!card.name || !card.platform || card.in_stock === false) continue;
    const seen = cheapest.get(card.platform);
    const price = typeof card.price === "number" ? card.price : Infinity;
    if (!seen || price < seen._price)
      cheapest.set(card.platform, { ...card, _price: price });
  }
  const entries = [...cheapest.values()].sort((a, b) => a._price - b._price);
  if (!entries.length) return null;
  const winner = asObject(p.winner).platform;
  const winnerId = providerId(winner, grocery ? 'grocery' : 'food');
  const winnerPlatform = (['swiggy_instamart', 'zepto'].includes(winnerId) ? PROVIDERS[winnerId].label : winner) || entries[0].platform;
  const priced = entries.filter((e) => e._price !== Infinity);
  return {
    query: p.query || "",
    vertical: grocery ? 'grocery' : 'food',
    entries: entries.map(({ _price, ...e }) => ({
      platform: e.platform,
      name: e.name,
      price: e.price ?? null,
      pack_size: e.pack_size || "",
      image_url: groceryCardsFromEnvelope({ payload: { cards: [e] } })[0]?.image_url || "",
      best: e.platform === winnerPlatform,
    })),
    /* A 500 ml pack is not "₹26 cheaper" than a 1 L one: savings are claimed
only when the two cheapest packs are the same size. */
    savings:
      priced.length > 1 &&
      packKey(priced[0].pack_size) === packKey(priced[1].pack_size)
        ? priced[1]._price - priced[0]._price
        : 0,
    caption: plainCaption(envelope?.text),
  };
}
function basketCompareModel(envelope) {
  const p = asObject(envelope?.payload);
  const rows = asArray(p.rows).map(asObject);
  if (!rows.length) return null;
  const totals = asObject(p.totals);
  return {
    label: p.label || "Basket",
    platforms: ["instamart", "zepto"].map((key) => ({
      key,
      name: PLATFORM_NAMES[key],
      total: totals[key] ?? null,
      missing: rows.filter((r) => !r[key]).map((r) => r.ingredient),
      best: p.winner === key,
    })),
    savings: p.savings || 0,
    commonCount: totals.common_count || 0,
    caption: plainCaption(envelope?.text),
  };
}
function spendModel(envelope) {
  const p = asObject(envelope?.payload);
  const platforms = asArray(p.platforms).map(asObject);
  if (!platforms.length) return null;
  const total = Number(p.total) || 0;
  const reprice = p.reprice ? asObject(p.reprice) : null;
  return {
    month: p.month || "",
    total,
    orderCount: p.order_count || 0,
    platforms: platforms.map((row) => ({
      platform: row.platform,
      total: row.total ?? null,
      orders: row.orders ?? null,
      available: row.available !== false,
      reason: row.reason || "",
      share: total && row.total ? row.total / total : 0,
    })),
    tip:
      reprice?.winner && Number(reprice.savings_estimate) > 0
        ? `${reprice.winner} is cheapest for your usual items — about ₹${reprice.savings_estimate} less per basket.`
        : null,
    actions: asArray(envelope?.actions),
    caption: plainCaption(envelope?.text),
  };
}
function nonEmpty(list) {
  return list.length ? list : null;
} /* kind -> { screen, map(envelope) -> model|null } */
const WIDGET_SCREENS = {
  text: { screen: "text", map: textModel },
  message: {
    screen: "text",
    map: (env) => (plainCaption(env?.text) ? textFallback(env, false) : null),
  },
  menu: {
    screen: "menu",
    map: (env) => {
      const m = menuFromEnvelope(env);
      return m.items.length ? m : null;
    },
  },
  basket_stocked: {
    screen: "agent-cart",
    map: agentCartModel,
  },
  cart: { screen: "agent-cart", map: agentCartModel },
  comparison: { screen: "compare", map: compareModel },
  basket: { screen: "basket-compare", map: basketCompareModel },
  spend_report: { screen: "spend", map: spendModel },
}; /* Allowlist, not a blocklist: only a payload.kind this table names gets a
route. An unrecognised or missing kind (a future carousel kind the TV
hasn't been taught yet) must fall back to the text screen, not land on
"Choose a Restaurant" by default. */
function carouselRoute(envelope) {
  const payload = asObject(envelope?.payload);
  const kind = payload.kind || asObject(payload.data).kind;
  if (kind === "grocery") {
    return {
      screen: "gresults",
      model: nonEmpty(groceryCardsFromEnvelope(envelope)),
    };
  }
  if (kind === "food" || kind === "dish" || kind === "restaurant_match") {
    return {
      screen: "restaurant",
      model: nonEmpty(restaurantCardsFromEnvelope(envelope)),
    };
  }
  return null;
}
export function screenForEnvelope(envelope) {
  const kind = envelope?.widget;
  let route = null;
  if (kind === "carousel") route = carouselRoute(envelope);
  else if (WIDGET_SCREENS[kind]) {
    const entry = WIDGET_SCREENS[kind];
    route = { screen: entry.screen, model: entry.map(envelope) };
  }
  if (!route || !route.model) {
    return {
      kind: "text",
      screen: "text",
      model: textFallback(envelope, true),
    };
  }
  return { kind: kind === "message" ? "text" : kind, ...route };
}
export function focusKeysFor(screen, model, { expanded = false } = {}) {
  const m = model || {};
  if (screen === "text") {
    return [
      ...(m.reconnectProvider ? ['reconnect-provider'] : []),
      ...asArray(m.actions).map((_, i) => `text-action-${i}`),
      ...(m.retry ? ["retry"] : []),
    ];
  }
  if (screen === "agent-cart") {
    if (!asArray(m.lines).length) return ['shop-more'];
    if (m.editable) return [...asArray(m.lines).flatMap((_, i) => [`acart-minus-${i}`, `acart-plus-${i}`]), 'acart-checkout', 'acart-clear'];
    const more = !expanded && asArray(m.lines).length > CART_PREVIEW;
    return ["acart-checkout", "acart-edit", ...(more ? ["acart-more"] : []), 'acart-clear'];
  }
  if (screen === "compare")
    return asArray(m.entries).map((_, i) => `cmp-order-${i}`);
  if (screen === "basket-compare")
    return asArray(m.platforms).map((_, i) => `bcmp-fill-${i}`);
  if (screen === "spend")
    return asArray(m.actions).map((_, i) => `spend-action-${i}`);
  return [];
}
export function defaultFocusFor(screen, model) {
  if (screen === 'agent-cart' && model?.editable && model.lines?.length) return 'acart-plus-0';
  if (screen === "basket-compare") {
    const best = asArray(model?.platforms).findIndex((p) => p.best);
    if (best >= 0) return `bcmp-fill-${best}`;
  }
  return focusKeysFor(screen, model)[0] || "back";
}
