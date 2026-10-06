# Zomato frontend investigation and fix

Baseline: repository commit `5e94442`. Scope: `tv-frontend` only. Validation used unit tests and Chromium with intercepted backend responses. No real provider requests, orders, payments, or OAuth operations were made. Live backend behavior has not been validated by these tests.

## Confirmed frontend causes

The baseline reproduced a history-dependent request difference. Given the same `Order pav bhaji from Zomato` utterance and the same connected session flags:

| Baseline visible state | Derived vertical | Appended platform instruction | Outbound view context |
| --- | --- | --- | --- |
| Clean home, Food | food | Compare Zomato and Swiggy | Home |
| Previous grocery results | grocery | Compare Instamart and Zepto | Grocery results and old product rows |
| Previous grocery cart | grocery | Compare Instamart and Zepto | Grocery cart and old cart rows |

`deriveIntent` defaulted searches to `view.vertical`; `searchPrompt` broadened explicit provider requests to the entire vertical. Food restaurant/menu/cart responses did not consistently restore the Food vertical, whereas grocery responses restored Grocery. Starting discovery cleared only some local fields, and `App.send` sent the previous visible view. These are confirmed frontend defects; they do not establish the cause of the live backend incident.

Additional findings:

- Search scope came from startup commerce-session platform flags even though merchant login observations could change independently. Malformed merchant responses were treated as false, and failed polls could fall back to stale session flags.
- An explicit provider mismatch was rendered normally with the returned provider. The renderer did not itself relabel Swiggy as Zomato, but it did not explain the conflict or preserve the original provider reliably during retry.
- The baseline manual Food prompt always requested Zomato and Swiggy, and restaurant mapping did not filter out Zomato. This checkout does not prove why live manual Food results lacked Zomato. Stale session flags could nevertheless exclude it from voice searches.
- Switching to the login overlay unmounted the commerce panel, losing local selection/cart state.
- Missing checkout QR data could show a spinner indefinitely. Tracking chose the generic step before the more specific payment-incomplete status; monotonic progression also suppressed a later explicit payment correction.
- Short named grocery requests could be classified as navigation rather than discovery. Local quantity routing could read the previous quantity/selection immediately after scheduling a React state update.

## Resulting behavior

Independent searches derive their vertical and explicit providers from the utterance. Zomato and Swiggy Food select Food; Instamart and Zepto select Grocery. Bare Swiggy selects Food unless the utterance contains grocery/ingredient intent. Explicit comparisons retain all positively requested providers; simple exclusions are not turned into positive preferences.

For an explicit provider, the raw utterance is preserved and the prompt constrains that provider alone. An unavailable provider must be reported rather than substituted. Generic discovery uses confirmed merchant login scope and explains that commerce-session availability remains the backend's decision. Successful current merchant observations override stale session flags for this scope, without rewriting the session's reported platforms.

For a new search, the outbound view is a neutral home view for the new vertical: no old item rows, cart count, selection, widget, or provider. The existing active-order flag is retained. Routing and financial guards run against the real visible view before outbound context is neutralized. Pending new discovery resets local restaurant, menu, item, quantity, grocery selection/results/basket, cart, widget and checkout presentation fields. The global tracked order survives. Older search responses and failures cannot replace a newer journey; real order descriptors are retained even if a response is unexpected.

References such as `show me the second one`, `open that restaurant`, `add two more`, and cheaper-result refinements retain the visible context. Quantity and selected grocery item are passed directly to cart mutation handlers so they do not depend on a just-scheduled React update. Checkout and pay requests remain confirmation guarded.

Provider attribution is read from normalized provider/platform/server fields, including cards, products, menus, carts and tracking; prose, artwork and URLs do not establish provider identity. A clearly attributed conflicting response shows a provider-specific error with retry/reconnect instead of silently accepting it. An explicit Zomato session-unavailable text response offers `Reconnect Zomato`. Unattributed envelopes are not guessed or stamped Zomato.

## Clean startup versus long history

Chromium exercised the actual App transcript handler, request construction and rendering. Only transcript delivery and backend transport were mocked. It compared startup Zomato with Zomato after the long sequence:

```text
Swiggy Food → another Food request → Instamart → ingredient basket
→ Zepto → another ingredient request → Swiggy Food → Zomato
```

The previous visible screen/items and original view revision differ, as expected. Derived intent is `search`, journey is `new-search`, vertical is `food`, and provider is `zomato` in both cases. Merchant observations and session flags are recorded separately. The actual intercepted `/api/chat` message and view are identical between the clean and long cases, with the fixture session ID redacted:

```json
{
  "session_id": "[redacted]",
  "message": "Order pav bhaji from Zomato\n\n[Platforms: Use Zomato only for this request. If a requested provider is unavailable in this commerce session, explain that provider's connection error. Do not substitute another provider.]",
  "view": {
    "screen": "home",
    "vertical": "food",
    "widget": "message",
    "focus_index": 0,
    "cartCount": 0,
    "hasActiveOrder": false,
    "view_revision": 3536372366,
    "items": []
  }
}
```

The mocked response and rendered restaurant provider are both Zomato. A separate mismatch fixture sends Swiggy for this correctly constrained request and verifies the specific failure state. This demonstrates the frontend boundary, not that a live backend will obey the prompt or that a fresh session repairs OAuth/MCP initialization. No automatic commerce-session recreation was added.

## Merchant changes

Merchant polling is serialized; polling runs immediately on opening the panel and then uses the existing interval. A successful boolean false takes effect. A failed or malformed poll retains the last actual boolean observation; it is not a logout or evidence of a new successful login. If no observation exists, only explicit existing session connection flags can supply the fallback.

Login status and commerce-session availability remain separate. Logs include observed and retained merchant state, session platform state, and effective discovery scope. Explicit provider discovery can reach the backend even if a local flag is false, so a newly valid backend response is not blocked by an old frontend observation. Existing responses and orders remain accessible after authentication loss. The login and commerce panels stay mounted when the visible overlay changes. Provider-specific reconnect waits for that merchant rather than unlocking Zomato just because Swiggy is connected. Pairing completion keeps the existing session-refresh behavior; it does not replay chat or checkout.

## Missing payment instructions

An actual Zomato order descriptor, UPI QR payment method, and absent QR now produce a bounded initial safe status check. The existing `/api/track` call has an eight-second frontend deadline. After that first check completes or fails, the payment screen shows:

> Zomato has not returned payment instructions yet. Check payment status or open this order in Zomato. Do not place the order again.

The screen retains the existing order ID and cart amount, with read-only `Check payment status`, Back and Shop More navigation. Later automatic or manual polls do not restart an indefinite waiting presentation. The underlying transport request is not aborted by the deadline; a late response to that timed-out attempt is ignored, and only tracking is retried.

Real QR images returned later still appear, and a newer tracking QR replaces an older checkout QR. Explicit payment-incomplete status takes precedence over a generic `Placed` step and can correct an earlier preparing presentation. Successful payment, preparation, delivery and cancellation handling remain supported. A tracking URL never becomes a payment QR. Missing payment instructions never trigger automatic checkout replay or a fabricated UPI target. Existing checkout double-click protection remains in use.

## Files changed

All paths below are relative to `tv-frontend`.

| File | Purpose |
| --- | --- |
| `src/quickbite/providers.js` (new) | Provider identity, new search/continuation classification, normalized response conflict detection |
| `src/quickbite/deriveIntent.js` | Utterance-derived search metadata, explicit grocery discovery, reference/quantity continuation |
| `src/quickbite/searchPrompt.js` | Preserve exclusive explicit provider scope; separate merchant login from session availability |
| `src/quickbite/viewContext.js` | Neutral outbound context for independent discovery; preserve active-order flag |
| `src/quickbite/merchantAccess.js` | Current discovery scope and retention of actual observations on failed polls |
| `src/App.jsx` | Request context, mismatch and unavailable errors, original retry, stale-result suppression, serialized status polling, targeted reconnect and panel lifecycle |
| `src/components/quickbite/QuickBitePanel.jsx` | Reset discovery state, correct returned vertical, direct continuation selection/quantity, payment fallback and newer QR presentation |
| `src/components/quickbite/screens/TextScreen.jsx` | Visible provider error and reconnect action |
| `src/components/quickbite/QrLoginPanel.jsx` | Provider-specific reconnect copy; remove login QR URL logging |
| `src/quickbite/widgetScreens.js` | Remote focus for reconnect action |
| `src/quickbite/payMode.js` | Recognize Zomato from an existing tracking server descriptor |
| `src/quickbite/tracking.js` | Explicit payment-pending precedence/corrections and bounded safe status wait |
| `src/hooks/useLiveOrderTracking.js` | Count completed checks, isolate in-flight state per order, clear duplicate scheduling and apply tracking deadline |
| `src/quickbite/commerceDiagnostics.js` (new) | Development/debug request, response and render attribution |
| `src/quickbite/voiceDiagnostics.js` | Redact diagnostic credentials, pairing URLs, private payment data and actual cycles while preserving shared references |
| `src/apiDiagnostics.js` | Apply the same redaction to existing transport logs |
| `src/quickbite/providerJourneys.test.js` (new) | Mixed journeys, provider scope, continuation, status and guard regressions |
| `src/quickbite/envelopes.test.js` | Descriptor/tracking URL is not a payment QR |
| `src/quickbite/tracking.test.js` | Payment corrections and safe deadline behavior |
| `src/quickbite/voiceDiagnostics.test.js` | Diagnostic redaction and repeated references |
| `scripts/frontend-regression.cjs` (new) | Browser request, render, reconnect, race, continuation and checkout regressions |
| `docs/zomato-frontend-investigation.md` (new) | Investigation, evidence, boundaries and validation report |

The existing endpoint implementation/request schema in `src/api.js`, backend source, OAuth/token persistence, and Bixby/STT capture modules were not changed. The diagnostic sanitizer is shared with voice logging; it changes logging only.

## Validation

`npm test`: **63 passed, 0 failed**. `npm run build`: **passed**, including TV and mobile assets. Vite emits the existing warning that the external Samsung `$WEBAPIS/webapis/webapis.js` script cannot be bundled as an ES module.

Chromium browser regressions passed with no page errors:

| Sequence or behavior | Result |
| --- | --- |
| Zomato first request | Passed |
| Swiggy Food → Zomato | Passed |
| Instamart → Zomato | Passed |
| Zepto → Zomato | Passed |
| Instamart → Zepto → Swiggy Food → Zomato | Passed |
| Zomato → Instamart → Zomato | Passed |
| Zomato → Zepto → Zomato | Passed |
| Kimchi ingredients from Instamart → Order sushi | Passed |
| Kimchi ingredients from Zepto → Zomato pav bhaji | Passed |
| Swiggy Food → Instamart → Swiggy Food | Passed |
| Long mixed sequence including ingredient baskets | Passed; final Zomato request equals startup request |
| Generic manual Food after Grocery, login true/session Zomato false | Passed; both returned Food providers visible |
| Swiggy returned for explicit Zomato | Passed; specific error, original-provider retry |
| Explicit Zomato accepted after local false; backend session unavailable | Passed; valid response visible, provider-specific reconnect |
| Reconnect while only Swiggy is connected | Passed; Zomato reconnect remains required; no request replay |
| Older search success and older HTTP failure after a newer search | Passed; newer provider presentation retained |
| Ordinal selection, add two more, restaurant continuation | Passed; selected Bread quantity is 2; reference context retained |
| New Zomato search from a grocery cart | Passed; old cart/items absent from request |
| Zomato UPI QR method + tracked order + no QR | Passed; stable message, no fabricated image, safe refresh |
| Later genuine QR and replacement QR | Passed; image and replacement accepted |
| Authentication loss with an existing Zomato order | Passed; same order and amount retained on reopening |
| Payment correction and subsequent delivery phases | Passed |
| Zomato checkout double click and repeated tracking refresh | Passed; exactly one order submission |
| Swiggy Food, Instamart and Zepto existing COD checkout presentation | Passed; exactly one submission each |

The non-Zomato COD browser fixtures exercise their payment/cart presentation, not live provider capabilities. Unit envelope tests and mixed grocery/browser continuations cover the genuine frontend grocery shapes. None of these results assert that a provider supports a particular live payment method.

To reproduce, start Vite in `tv-frontend` with `npm run dev -- --port 5174`, then run `node scripts/frontend-regression.cjs`. It requires Playwright and a Chromium executable (provided by this cloud workspace). For another executable, set `CHROMIUM_EXECUTABLE_PATH`; an optional first argument selects another Vite URL. The script intercepts all commerce calls and saves sanitized scenario traces at `/tmp/quickbite-provider-evidence.json`.

`[CommerceFlow]` logging is enabled in development; for a production debugging session set `localStorage.ca_debug = '1'`. Request logs record original utterance, derived intent, previous visible view, actual outbound request, observed merchant status, session platforms and effective scope. Response and render events retain actual normalized provider attribution. Credentials/session IDs and private QR/UPI targets are redacted. Console logs describe normalized HTTP envelopes, not raw internal MCP tool output.

## Remaining external boundary

Once the correctly constrained Zomato request reaches the backend, a returned Swiggy response, session-unavailable response, changed authentication flag, failed provider initialization, token expiry, or absent payment payload originates outside frontend request construction/rendering. The frontend now handles and exposes those outcomes; it cannot repair OAuth, create missing payment instructions, or locate where the backend lost a raw MCP payment result. This checkout contains no evidence proving the engineer's successful fresh request repaired the live demo session. That observation remains correlation.
