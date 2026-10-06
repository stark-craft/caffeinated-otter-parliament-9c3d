import {
  platformConnection,
} from './envelopes.js'
import { PROVIDERS, requestedProviders } from './providers.js'

/* What a spoken search sends to the backend.
 *
 * Two failed shapes got us here:
 *
 *   1. The raw transcript alone. It names no platform, so "chole bhature"
 *      came back from Zomato only while Swiggy sat connected and unused.
 *   2. Rewriting it as "Compare <query> across Zomato and Swiggy". That fixed
 *      dish searches and broke everything else: "order from Lazzat e Lucknow"
 *      became a search for a DISH called "Lazzat e Lucknow" and returned
 *      nothing. core/agent.py:175 hands compare_food a dish keyword, and :177
 *      says a named-restaurant request must not use compare_food at all.
 *
 * So the utterance stays exactly as the user said it — that sentence is what
 * the agent routes on — and the platform scope rides along as a constraint
 * rather than a command. The agent keeps choosing the tool; it just may not
 * choose a platform the user is not logged in to, or one from the other
 * vertical.
 */

const VERTICALS = {
  food: {
    // `group` is the connection entry; `label` is what the prompt says. They
    // differ for Instamart: the account is the "Swiggy" group, but naming bare
    // "Swiggy" in a grocery prompt would point the agent at food.
    platforms: [
      {
        group: 'Zomato',
        label: 'Zomato',
      },
      {
        group: 'Swiggy',
        label: 'Swiggy',
      },
    ],
    compare:
      'If this is a dish or cuisine search, compare across both and show me restaurants I can order from. If it names a specific restaurant, open that restaurant on whichever platform has it instead of comparing.',
  },

  grocery: {
    platforms: [
      {
        group: 'Swiggy',
        label: 'Swiggy Instamart',
      },
      {
        group: 'Zepto',
        label: 'Zepto',
      },
    ],
    compare:
      'If this is a product search, compare across both and show me the cheapest options. If it names a specific store or brand, use that instead of comparing.',
    fill:
      'This asks to add items to my cart, not to compare platforms — fill the cart.',
  },
}

const FILLS_CART =
  /\badd\b|\bcart\b|\brecipe\b|\bingredients?\b|\beverything\b/u

export function searchPrompt(
  utterance,
  vertical,
  platforms,
) {
  const said =
    String(utterance || '')
      .trim()

  if (!said) return ''

  const requested = requestedProviders(said)
  if (requested.length) {
    const names = requested.map(id => PROVIDERS[id].label).join(' and ')
    return `${said}\n\n[Platforms: Use ${names} only for this request. If a requested provider is unavailable in this commerce session, explain that provider's connection error. Do not substitute another provider.]`
  }

  const spec =
    VERTICALS[vertical] ||
    VERTICALS.food

  const connected =
    spec.platforms.filter(
      (entry) =>
        platformConnection(
          platforms,
          entry.group,
        ).known && platformConnection(platforms, entry.group).connected,
    )

  /* Nothing connected is not a reason to drop the utterance: asking anyway
     lets the backend answer with its own "connect a platform first", which
     tells the user more than silence does. */

  const targets = connected

  const names =
    targets.map(
      (p) => p.label,
    )

  /* "Compare across both" on a request to FILL the cart steered the agent to
     compare_basket, which adds nothing and spends one Zepto search per item
     (429 after ~7). A recipe / add-to-cart request keeps the platform scope but
     drops the compare instruction; a product search ("buy milk") keeps it. */

  const fillsCart =
    vertical === 'grocery' &&
    FILLS_CART.test(
      said.toLowerCase(),
    )

  const scope =
    !names.length
      ? `No merchant connection has been confirmed for ${vertical || 'food'}. Explain which login is required.`
      : names.length > 1
      ? `Merchant login is confirmed for ${names.join(' and ')}. ${
          fillsCart
            ? spec.fill
            : spec.compare
        }`
      : `Merchant login is confirmed for ${names[0]} only — use ${names[0]} only.`

  /* Only the permitted platforms are named. An earlier draft added "do not use
     <other vertical>", but naming a platform in order to forbid it is exactly
     the prompt shape models get wrong - the safe constraint is the positive
     list alone. */

  return `${said}\n\n[Platforms: ${scope} If a provider is unavailable in this commerce session, explain its connection error.]`
}
