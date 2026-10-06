# QuickBite pre-Astra UI integration

Starting implementation: `a5a174f4f3f3b68b2d9cc0adb1090c69620f27fa` on `fix/zomato-frontend-state`. Previous `origin/main`: `5e944428053862da1ca4a8ae2ad9e514f7bc6fef`. Working tree was clean before integration. Work was added separately on `integrate/quickbite-pre-astra-ui`; no older files were copied wholesale and the Zomato commit was not amended or rewritten.

Local rollback tags:

- `backup/quickbite-pre-astra-main-5e94442`
- `backup/quickbite-pre-astra-zomato-a5a174f`

## Restored behavior

- `basket_stocked` now opens `agent-cart` with `editable: true` and `source: basket_stocked`. Compatible grocery carts share that editor. Available positive-quantity rows retain name, count, unit/line pricing, pack/requested metadata and safe image fallbacks. Unavailable/zero rows are excluded and an empty basket has an explicit empty-cart state.
- Clearly grocery Swiggy data displays `Swiggy Instamart`, including cart, product and comparison normalization. Food Swiggy retains its Food identity.
- Compact cart-list rows use 60 px images, readable names/metadata, per-row minus/plus controls and line totals. Narrow sidebars put controls below the name so names do not collapse into vertical letter stacks. The focused ingredient row and control are both visible.
- Up/Down preserve the current quantity-control column between rows; Left/Right move between minus/plus. Down from the last ingredient reaches the bottom action; Up returns to the last ingredient's plus control.
- Quantity changes are local drafts. Reviewing sends only changed rows as exact quantity updates to the existing chat/cart agent path, explicitly prohibiting duplicate additions, other item changes, checkout and payment. The UI immediately opens My Cart with its existing loading state, then displays the returned bill and actual `env.actions`. Double clicks are guarded. Failed/uncertain edits retry by reading the current cart, not replaying the quantity mutation.
- Comparison cards remain vertically stacked. The entire focused provider card receives an orange border/background/glow independently of the persistent Best ribbon.
- Widget models are preserved by screen within the current journey, so comparison → provider/cart → Back restores the comparison rather than passing a cart model to it. New independent searches clear these models. `CompareScreen` also safely handles a stale object lacking entries.
- Widget/cart requests are scoped to the current journey so a result arriving after Back or a newer independent search cannot overwrite the new screen. Existing global order evidence remains owned by App.
- Exact cart cancel/clear labels now use the existing confirmation strip. Keep cart sends nothing; Confirm sends the original backend label once. Declines returned from checkout route their response normally instead of being mistaken for a failed payment. Order cancellation is not guessed from these cart labels.

## Preserved contracts and limits

Normal review quantity minimum/disabled-minus behavior and immediate Add-to-Cart loading already existed and were retained. Stocked baskets already represent items written into a provider cart: unchanged Checkout reads that cart instead of adding the basket again. Local estimates are labelled item subtotals; the backend bill remains authoritative.

Quantity-zero removal was intentionally not enabled: this checkout has no explicit row-removal/zero-quantity contract establishing that meaning. The editor keeps a minimum of one. Unavailable/zero incoming rows are filtered, and whole-cart cancel/clear is available through confirmed backend labels. No new payment endpoint, synthetic checkout action, automatic action selection, fake QR, or checkout replay was added.

The Zomato layer's provider constraints/mismatch detection, independent-search views, older-response suppression, merchant/session distinction, reconnect, order preservation, tracking isolation, payment-incomplete correction, bounded missing-payment presentation and diagnostic redaction remain intact.

Backend source, OAuth/token persistence, Bixby/STT capture and the `/api/chat`, `/api/session`, `/api/track` transport contracts were not modified. All browser commerce responses were mocked; this is not live Zomato/provider validation.

## Integration file inventory

Paths are relative to `tv-frontend`. A = added; M = modified compared with `a5a174f`.

| Status | File | Change |
| --- | --- | --- |
| A | `docs/quickbite-pre-astra-integration.md` | Scope, rollback refs, restored behavior and validation |
| M | `scripts/frontend-regression.cjs` | Retain Zomato regressions; test restored editor, focus, Back, races and destructive actions |
| M | `src/components/quickbite/QuickBitePanel.jsx` | Scoped models/requests, quantity draft review, navigation and confirmed destructive dispatch |
| M | `src/components/quickbite/screens/AgentCartScreen.jsx` | Compact editable rows, estimates and empty state |
| M | `src/components/quickbite/screens/CompareScreen.jsx` | Defensive entries and outer-card focus |
| A | `src/quickbite/agentCart.js` | Grocery normalization, local quantity updates, estimates and changed-row review prompt |
| A | `src/quickbite/agentCart.test.js` | Normalization, edits, safe images, scope and destructive-label regressions |
| M | `src/quickbite/envelopes.js` | Safe image helper/fallbacks, quantity/count aliases and clear grocery labels |
| M | `src/quickbite/navigation.js` | Editable-cart arrow navigation |
| M | `src/quickbite/navigation.test.js` | Row/control/bottom-action navigation tests |
| M | `src/quickbite/viewContext.js` | Actual editable/comparison references; cart pricing remains excluded from outbound views |
| M | `src/quickbite/widgetScreens.js` | Stocked-to-editor routing, grocery comparison identity, focus keys and cancel/clear detection |
| M | `src/styles/quickbite.css` | Compact rows and distinct comparison outer focus |

## Validation before merge

- `npm test`: **73 passed, 0 failed**, including all 63 pre-existing Zomato/baseline tests.
- `node scripts/frontend-regression.cjs`: **29 mocked scenarios passed** with no browser page errors. Includes all original provider/reconnect/checkout/tracking scenarios, three editable grocery variants, vertical comparison focus and nested cart/Back restoration, an explicitly stale comparison model, a late widget response after new Zomato discovery, and three confirmed cancel/clear labels. Checkout/status tests still assert one order submission; editor tests assert no orders.
- `npm run build`: **passed**, producing TV and mobile assets. Existing Samsung external `$WEBAPIS` bundling warning remains.
- `git diff --check`: **passed**.

Browser screenshots were inspected for ingredient density and comparison focus. They are exported at `/tmp/quickbite-editable-cart.png` and `/tmp/quickbite-compare-focus.png` in the validation workspace.

The integration is committed separately, then merged into current `main` without squashing the Zomato commit. Verify ancestry and exact file sets with `git log --oneline --graph`, `git diff a5a174f <integration-commit> --name-status`, and `git diff 5e94442 main --name-status`.
