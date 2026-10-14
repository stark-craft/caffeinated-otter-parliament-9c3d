import { matchable, normalizeTranscript } from "./transcript.js";
import { searchJourney } from "./providers.js";

/* Phase 1 classifier. * * Three separate passes, because entangling them is what broke the first * attempt: *
1. parseItemRef
- which thing on screen is being referred to *
2. parseQuantity - how many, read from what is LEFT after the reference *
is removed ("the cheaper one" must not yield qty 1 *
just because it contains the word "one") *
3. matchRule
- what to do, first match wins, ordered specific first * * Rules carry their own confidence. Scoring by how many words a pattern * matched made the generic "show me" outrank the specific "cart", which is * how "show me my cart" became a search. */
const CART = /\bcarts?\b|कार्ट|\bbasket\b|टोकरी/u;
const SHOW = /\bshow\b|\bsee\b|\bopen\b|\bview\b|dikhao|दिखाओ|\bmera\b|मेरा/u;
const ORDINAL_PATTERNS = [
  { re: /\b(?:the\s+)?(?:first|1st)\s*(?:one)?\b|पहला|pehla/u, index: 0 },
  {
    re: /\b(?:the\s+)?(?:second|2nd)\s*(?:one)?\b|दूसरा|doosra|dusra/u,
    index: 1,
  },
  { re: /\b(?:the\s+)?(?:third|3rd)\s*(?:one)?\b|तीसरा|teesra/u, index: 2 },
  { re: /\b(?:the\s+)?(?:fourth|4th)\s*(?:one)?\b|चौथा|chautha/u, index: 3 },
];
const CHEAPEST =
  /\b(?:the\s+)?(?:cheaper|cheapest|lowest|less expensive)\s*(?:one)?\b|सस्ता|sasta/u;
const BEST =
  /\b(?:the\s+)?(?:best|highest|top|best rated)\s*(?:one)?\b|अच्छा|sabse achha/u;
const DEICTIC = /\bthis\s*(?:one)?\b|\bthat\s*(?:one)?\b|\bit\b|इसे|इसमें|यह/u;
const NUMBER_WORDS = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  one: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  ek: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पाँच: 5,
  एक: 1,
};
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
} /* "The Bombay Canteen" must not match on "the": the word is in nearly every
utterance, so one such card on screen would capture the whole classifier. */
const NAME_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "my",
  "cafe",
  "café",
]);
function nameToken(name) {
  const words = String(name || "")
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);
  // Every word a stopword ("The Cafe") - fall back rather than match nothing.
  return words.find((w) => !NAME_STOPWORDS.has(w)) || words[0] || "";
}
function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
} /* A whole-word test, not a substring one: "dal" must not match "dalgona".
Lookarounds rather than \b because \b is ASCII-only - `/\bबिरयानी\b/u` never
matches, and Devanagari item names would stop resolving altogether. */
function wholeWord(token) {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRe(token)}(?![\\p{L}\\p{N}])`,
    "u",
  );
} /* Returns { ref, consumed } - `consumed` is the slice of text the reference
used up, so quantity parsing never sees it again. */
export function parseItemRef(text, items, focusIndex = 0) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { ref: null, consumed: "" };
  // Superlatives first: "the cheaper one" is a superlative that happens to
  // contain "one", not the first ordinal.
  const cheap = text.match(CHEAPEST);
  if (cheap) {
    const priced = list.filter((i) => num(i.price) !== null);
    if (priced.length) {
      const winner = priced.reduce((a, b) =>
        num(a.price) <= num(b.price) ? a : b,
      );
      return {
        ref: {
          type: "superlative",
          value: "cheapest",
          resolved_id: winner.id,
          resolved_name: winner.name,
        },
        consumed: cheap[0],
      };
    }
  }
  const best = text.match(BEST);
  if (best) {
    const rated = list.filter((i) => num(i.rating) !== null);
    if (rated.length) {
      const winner = rated.reduce((a, b) =>
        num(a.rating) >= num(b.rating) ? a : b,
      );
      return {
        ref: {
          type: "superlative",
          value: "best_rated",
          resolved_id: winner.id,
          resolved_name: winner.name,
        },
        consumed: best[0],
      };
    }
  }
  for (const { re, index } of ORDINAL_PATTERNS) {
    const hit = text.match(re);
    if (hit && list[index]) {
      return {
        ref: {
          type: "ordinal",
          value: index + 1,
          resolved_id: list[index].id,
          resolved_name: list[index].name,
        },
        consumed: hit[0],
      };
    }
  }
  for (const item of list) {
    const token = nameToken(item.name);
    if (token && token.length > 2 && wholeWord(token).test(text)) {
      return {
        ref: {
          type: "name",
          value: item.name,
          resolved_id: item.id,
          resolved_name: item.name,
        },
        consumed: token,
      };
    }
  }
  const more = text.match(/\b(?:one|two|three|four|five|\d{1,2})\s+more\b/u);
  const deictic = text.match(DEICTIC) || more;
  if (deictic) {
    const target = list[focusIndex] || list[0];
    return {
      ref: {
        type: "deictic",
        value: "focused",
        resolved_id: target.id,
        resolved_name: target.name,
      },
      consumed: more ? "more" : deictic[0],
    };
  }
  return { ref: null, consumed: "" };
}
export function parseQuantity(text) {
  const digits = text.match(/\b(\d{1,2})\b/u);
  if (digits) return Number(digits[1]);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, "u").test(text)) return value;
  }
  return null;
}
export function parsePriceMax(text) {
  const m = text.match(
    /(?:under|below|cheaper than|less than|se kam|से कम)\D{0,8}(\d{2,5})/u,
  );
  if (m) return Number(m[1]);
  const bare = text.match(/\b(\d{2,5})\b/u);
  return bare && /cheap|under|below|kam|सस्ता/u.test(text)
    ? Number(bare[1])
    : null;
} /* Ordered most-specific first. FIRST MATCH WINS - order is meaningful here,
unlike the scored version it replaces. */
const RULES = [
  {
    name: "go_back",
    conf: 0.95,
    re: /^(?:go\s+)?back\b|\bgo back\b|पीछे|peeche|वापस|wapas/u,
  },
  {
    name: "change_qty",
    conf: 0.92,
    re: /\bmake it\b|\bone more\b|\bchange (?:the )?quantity\b|और एक|aur ek/u,
  },
  { name: "add_to_cart", conf: 0.93, re: /\badd\b|\bऐड\b|डाल|daal|dal do/u },
  {
    name: "remove_item",
    conf: 0.93,
    re: /\bremove\b|\bdelete\b|\btake out\b|हटा|hata|nikal/u,
  },
  {
    name: "cancel_order",
    conf: 0.93,
    re: /\bcancel\b[\s\S]*\border\b|\border\b[\s\S]*\bcancel\b|रद्द/u,
  },
  {
    name: "track_order",
    conf: 0.93,
    re: /\btrack\b|\bwhere\b[\s\S]*\border\b|ऑर्डर[\s\S]*कहाँ|order kaha|\border status\b/u,
  },
  {
    name: "checkout",
    conf: 0.91,
    re: /\bcheckout\b|\bplace (?:the )?order\b|ऑर्डर करो|order karo/u,
  },
  { name: "pay", conf: 0.92, re: /\bpay\b|\bpayment\b|\bupi\b|पेमेंट|भुगतान/u },
  { name: "show_cart", conf: 0.93, test: (t) => CART.test(t) && SHOW.test(t) },
  {
    name: "show_cart",
    conf: 0.85,
    test: (t) => CART.test(t) && t.split(/\s+/).length <= 3,
  },
  {
    name: "compare",
    conf: 0.9,
    re: /\bcompare\b|\bwhich is cheaper\b|तुलना|kaun sasta/u,
  },
  {
    name: "refine",
    conf: 0.89,
    re: /\bcheaper\b|\bunder\b|\bbelow\b|\bless than\b|\bonly\b|सस्ता|se kam/u,
  },
  {
    name: "switch_vertical",
    conf: 0.9,
    re: /\bgrocer\w*\b|ग्रोसरी|किराना|kirana|\binstamart\b|\bzepto\b/u,
  },
  {
    name: "switch_vertical",
    conf: 0.88,
    test: (t) => /\bfood\b|खाना|\brestaurants?\b/u.test(t) && SHOW.test(t),
  },
  {
    name: "confirm",
    conf: 0.9,
    re: /^(?:yes|yeah|yep|confirm|ok|okay|haan|हाँ|theek hai)\b/u,
  },
  { name: "stop", conf: 0.9, re: /^stop\b|\bnever mind\b|रुको|ruko|chhodo/u },
  { name: "go_home", conf: 0.9, re: /\bhome\b|\bstart over\b|होम|shuru/u },
  {
    name: "repeat",
    conf: 0.9,
    re: /\brepeat\b|\bwhat did you say\b|dobara|फिर बोलो/u,
  },
  {
    name: "select",
    conf: 0.9,
    re: /\bselect\b|\bchoose\b|\bpick\b|चुनो|chuno/u,
  },
  {
    name: "search",
    conf: 0.86,
    re: /\bfind\b|\bsearch\b|\bshow me\b|\blooking for\b|ढूंढ|dhundho|dikhao|दिखाओ/u,
  },
];
function matchRule(text) {
  for (const rule of RULES) {
    const hit = rule.test ? rule.test(text) : rule.re.test(text);
    if (hit) return rule;
  }
  return null;
}
function stripQuery(text) {
  return text
    .replace(
      /\b(find|search|show|me|the|best|near|my|for|a|an|please|some|something|dikhao|ढूंढ)\b/gu,
      " ",
    )
    .replace(/\s+/gu, " ")
    .trim();
}
const NEEDS_REF = new Set([
  "select",
  "add_to_cart",
  "remove_item",
  "change_qty",
]); /* "Search the recipe and add the ingredients to my cart" matched add_to_cart
(first match wins), found nothing on screen to add, and raised "Nothing to
choose from yet." - the request never reached the agent, which is the only
thing that can do both halves. When the utterance asks to find something and
points at no on-screen item, a trailing action is part of the search. */
const SEARCH_LEAD =
  /\bsearch\b|\bfind\b|\blooking for\b|\brecipe\b|\bingredients?\b|ढूंढ|dhundho/u;
const FOLDS_INTO_SEARCH = new Set([
  "add_to_cart",
  "change_qty",
  "remove_item",
  "select",
  "checkout",
  "pay",
  "show_cart",
  "switch_vertical",
]);
const GROCERY_CUE =
  /grocer|ग्रोसरी|किराना|kirana|instamart|zepto|\brecipe\b|\bingredients?\b/u; /* Keywords alone missed "help me build a diet chart and the items I need ...
add to cart from Instamart" - no search word, so it stayed add_to_cart and
died on an empty screen. A long request to add things that names no item on
screen is a list for the agent to build. Checkout and pay are left out: a
long "place the order with UPI" is still a checkout. */
const LIST_BUILDERS = new Set(["add_to_cart", "select", "switch_vertical"]);
const LONG_REQUEST_WORDS = 10;
export function deriveIntent(transcript, view, envelope) {
  const raw = normalizeTranscript(transcript);
  const text = matchable(transcript);
  const journey = searchJourney(raw, view);
  const searchSlots = () => ({ query: stripQuery(text), vertical: journey.vertical,
    providers: journey.providers, provider: journey.providers.length === 1 ? journey.providers[0] : null });
  const items = view?.items || [];
  const language = envelope?.language || view?.language || "en-IN";
  const base = {
    slots: {},
    target: null,
    alternatives: [],
    language,
    speech: "",
    transcript: raw,
    journey: journey.kind,
    view_revision: view?.view_revision ?? null,
  };
  if (!text) return { ...base, name: "unknown", confidence: 0 };
  // A bare "cancel" is cancel_order or stop and is never guessed.
  if (/^cancel\.?$|^रद्द$/u.test(text)) {
    return {
      ...base,
      name: "unknown",
      confidence: 0.41,
      alternatives: [
        { name: "cancel_order", confidence: 0.41 },
        { name: "stop", confidence: 0.38 },
      ],
    };
  }
  const { ref, consumed } = parseItemRef(text, items, view?.focus_index ?? 0);
  const remainder = consumed ? text.replace(consumed, " ") : text;
  const rule = matchRule(text);
  // A fresh named search stays fresh even when its subject also appears in
  // the previous result list. Ordinal/deictic continuations still select it.
  if (ref && journey.kind === "continuation" && (!rule || rule.name === "search" || rule.name === "switch_vertical")) {
    return { ...base, name: "select", confidence: 0.9, slots: { item_ref: ref } };
  }
  const longListRequest =
    rule &&
    LIST_BUILDERS.has(rule.name) &&
    text.split(/\s+/u).length >= LONG_REQUEST_WORDS;
  if (
    rule &&
    (!ref || journey.kind === "new-search") &&
    FOLDS_INTO_SEARCH.has(rule.name) &&
    (SEARCH_LEAD.test(text) || longListRequest || (journey.providers.length && rule.name === 'switch_vertical'))
  ) {
    return {
      ...base,
      name: "search",
      confidence: 0.86,
      slots: searchSlots(),
    };
  }
  // A bare reference with no verb is a selection: "the second one".
  if (!rule && ref && journey.kind === "continuation") {
    return {
      ...base,
      name: "select",
      confidence: 0.88,
      slots: { item_ref: ref },
    };
  }
  if (!rule) {
    // Unmatched but plausibly a search - hand it to the backend rather than
    // stripping, which would make open-ended speech worse than before.
    return {
      ...base,
      name: "search",
      confidence: 0.62,
      slots: searchSlots(),
      unmatched: true,
    };
  }
  const slots = {};
  if (NEEDS_REF.has(rule.name) && ref) slots.item_ref = ref;
  if (rule.name === "add_to_cart" || rule.name === "change_qty") {
    slots.quantity = parseQuantity(remainder) ?? 1;
  }
  if (rule.name === "refine") {
    const priceMax = parsePriceMax(text);
    if (priceMax != null) slots.price_max = priceMax;
  }
  if (rule.name === "search") {
    Object.assign(slots, searchSlots());
  }
  if (rule.name === "refine" || rule.name === "compare") {
    Object.assign(slots, { vertical: journey.kind === "continuation" ? view?.vertical || "food" : journey.vertical,
      providers: journey.providers, provider: journey.providers.length === 1 ? journey.providers[0] : null });
  }
  if (rule.name === "switch_vertical") {
    slots.vertical = /grocer|ग्रोसरी|किराना|kirana|instamart|zepto/u.test(text)
      ? "grocery"
      : "food";
    // Keep a named provider even when this is parsed as navigation, not search.
    slots.providers = journey.providers;
    slots.provider = journey.providers.length === 1 ? journey.providers[0] : null;
  }
  return { ...base, name: rule.name, confidence: rule.conf, slots };
}
