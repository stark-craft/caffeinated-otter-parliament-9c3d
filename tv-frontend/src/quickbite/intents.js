const CONFIDENCE_FLOOR = 0.6;
const LOCKED_SCREENS = new Set(["pay", "payment-received"]);
const LOCK_ALLOWED = new Set([
  "confirm",
  "cancel_order",
  "track_order",
  "go_back",
]);
const strip = (question, options) => ({ question, options });
function held(patch = {}, stripValue = null) {
  return {
    screen: null,
    focusKey: null,
    patch,
    strip: stripValue,
    jumpOrigin: null,
    action: null,
    openPane: true,
  };
}
function go(screen, focusKey, patch = {}, from = null, action = null) {
  return {
    screen,
    focusKey,
    patch,
    strip: null,
    action,
    openPane: true,
    jumpOrigin: from && from !== screen ? { from, to: screen } : null,
  };
}
export function routeIntent(intent, view) {
  const name = intent?.name || "unknown";
  const confidence = Number(intent?.confidence ?? 0);
  const slots = intent?.slots || {};
  const here = view?.screen || "home";
  const items = view?.items || [];
  // Payment screens lock out everything except a few allowed intents.
  if (LOCKED_SCREENS.has(here) && !LOCK_ALLOWED.has(name)) {
    return held(
      {},
      strip("Payment in progress. Cancel the order?", [
        { label: "Keep paying", intent: "stop" },
        { label: "Cancel order", intent: "cancel_order" },
      ]),
    );
  }
  // A rate limit is not a wrong screen, it is a full one.
  if (/\b429\b|too many requests|rate limit/i.test(intent?.error || "")) {
    return held(
      {},
      strip("The store is busy. Try again in a moment.", [
        { label: "Try again", intent: name, retry: true },
        { label: "Show my cart", intent: "show_cart" },
        { label: "Cancel", intent: "stop" },
      ]),
    );
  }
  // Results changed under the utterance: "the second one" must not act on a
  // list the user is no longer looking at.
  if (
    intent?.view_revision != null &&
    view?.view_revision != null &&
    intent.view_revision !== view.view_revision &&
    slots.item_ref
  ) {
    return held(
      {},
      strip(
        "The results changed. Which one?",
        items
          .slice(0, 3)
          .map((item) => ({
            label: item.name,
            intent: "select",
            itemId: item.id,
          }))
          .concat([{ label: "Cancel", intent: "stop" }]),
      ),
    );
  }
  if (confidence < CONFIDENCE_FLOOR || name === "unknown") {
    const options = (intent?.alternatives || [])
      .slice(0, 2)
      .map((alt) => ({ label: alt.name.replace(/_/g, " "), intent: alt.name }));
    while (options.length < 2) {
      options.push(
        options.length === 0
          ? { label: "Find biryani", intent: "search" }
          : { label: "Show my cart", intent: "show_cart" },
      );
    }
    return held(
      {},
      strip("Did you mean:", [...options, { label: "Cancel", intent: "stop" }]),
    );
  }
  const needsRef = [
    "select",
    "add_to_cart",
    "remove_item",
    "change_qty",
  ].includes(name);
  if (
    needsRef &&
    !slots.item_ref?.resolved_id &&
    !["change_qty", "remove_item"].includes(name)
  ) {
    if (!items.length) {
      return held(
        {},
        strip("Nothing to choose from yet.", [
          { label: "Find food", intent: "search" },
          { label: "Cancel", intent: "stop" },
        ]),
      );
    }
    return held(
      {},
      strip(
        "Which one?",
        items
          .slice(0, 3)
          .map((item) => ({ label: item.name, intent: name, itemId: item.id }))
          .concat([{ label: "Cancel", intent: "stop" }]),
      ),
    );
  }
  switch (name) {
    case "go_back":
      return { ...held(), screen: "__back__" };
    case "stop":
      return { ...held(), openPane: false };
    case "repeat":
      return held();
    case "go_home":
      return go("home", "start-shopping");
    case "switch_vertical": {
      const vertical = slots.vertical === "grocery" ? "grocery" : "food";
      return go(
        vertical === "grocery" ? "gcategory" : "category",
        vertical === "grocery" ? "gcategory-0" : "category-0",
        { vertical },
        here,
      );
    }
    case "track_order":
      // A strip, not a notice: notices render on seven screens, the strip on
      // all of them, and "nothing to track" must be visible wherever asked.
      if (!view?.hasActiveOrder) {
        return held(
          {},
          strip("There is no active order.", [
            { label: "Keep shopping", intent: "go_home" },
            { label: "Cancel", intent: "stop" },
          ]),
        );
      }
      // The real phase comes from the tracking snapshot, not a fixed screen.
      return go("__tracking__", "refresh-tracking", {}, here);
    case "show_cart":
      if (!view?.cartCount) {
        return held(
          {},
          strip("Your cart is empty.", [
            { label: "Find food", intent: "search" },
            { label: "Cancel", intent: "stop" },
          ]),
        );
      }
      return go("cart", "checkout-action-0", {}, here);
    case "select":
      return go(null, null, {}, here, {
        name: "select",
        args: { itemId: slots.item_ref.resolved_id },
      });
    case "add_to_cart":
      return go(null, null, {}, here, {
        name: "addToCart",
        args: {
          itemId: slots.item_ref.resolved_id,
          quantity: slots.quantity ?? 1,
        },
      });
    case "change_qty":
      if (!view?.cartCount)
        return held(
          {},
          strip("Your cart is empty.", [
            { label: "Find food", intent: "search" },
            { label: "Cancel", intent: "stop" },
          ]),
        );
      return go(null, null, {}, here, {
        name: "changeQty",
        args: {
          itemId: slots.item_ref?.resolved_id ?? null,
          quantity: slots.quantity ?? 1,
        },
      });
    case "remove_item":
      if (!view?.cartCount)
        return held(
          {},
          strip("Your cart is empty.", [
            { label: "Find food", intent: "search" },
            { label: "Cancel", intent: "stop" },
          ]),
        );
      return go(null, null, {}, here, {
        name: "removeItem",
        args: { itemId: slots.item_ref?.resolved_id ?? null },
      });
    // Financial and destructive: navigate only, then wait for a remote press.
    case "checkout":
    case "pay":
      if (!view?.cartCount) {
        return held(
          {},
          strip("Nothing to pay for yet.", [
            { label: "Find food", intent: "search" },
            { label: "Cancel", intent: "stop" },
          ]),
        );
      }
      return {
        ...go("cart", "checkout-action-0", {}, here),
        awaitConfirm: "pay",
        notice: "Press OK to confirm payment",
      };
    case "cancel_order":
      if (!view?.hasActiveOrder) {
        return held(
          {},
          strip("There is no order to cancel.", [
            { label: "Keep shopping", intent: "go_home" },
            { label: "Cancel", intent: "stop" },
          ]),
        );
      }
      return {
        ...go("__tracking__", "checkout-action-0", {}, here),
        awaitConfirm: "cancel_order",
        notice: "Press OK to confirm cancellation",
      };
    case "confirm":
      // Confirm only means something when something is awaiting it; the panel
      // supplies that, and a bare "yes" otherwise does nothing.
      return { ...held(), action: { name: "confirmPending", args: {} } };
    case "search":
    case "refine":
    case "compare":
      return go(
        "__discovery__",
        "back",
        {
          loadingPhase: "restaurants",
          vertical: slots.vertical || view?.vertical || "food",
        },
        here,
      );
    default:
      return held(
        {},
        strip("Did you mean:", [
          { label: "Find biryani", intent: "search" },
          { label: "Show my cart", intent: "show_cart" },
          { label: "Cancel", intent: "stop" },
        ]),
      );
  }
}
export { CONFIDENCE_FLOOR };
