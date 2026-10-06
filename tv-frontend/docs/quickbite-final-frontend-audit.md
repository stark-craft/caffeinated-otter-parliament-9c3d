# Final QuickBite frontend audit

Baseline: `main @ ec21c58d1347212a04ac42e69d750089c72cf4e6`. This is a new focused frontend change; `a5a174f`, `4733603` and `ec21c58` remain unchanged in history.

## Focus findings and fixes

| Root cause | Resulting fix |
| --- | --- |
| ConfirmStrip kept the underlying `.is-focused` control visible while focusing its own option | Keep the logical target separately; render no underlying focus while open. Underlying screen/navigation become inert and hidden from assistive navigation. Dialog owns native focus, traps Tab, and restores the original target when dismissed. |
| Hover used the same border/glow as remote focus | Strong rings depend on current navigation state. Actual mouse movement and keyboard/browser focus update that state; a stationary pointer cannot steal focus when content changes underneath it. |
| Comparison card and inner action both had strong focus | The outer card is the single focus surface, with native focus on its action. Vertical Up/Down navigation is retained. Basket comparison uses the same hierarchy. |
| Editable ingredient row and its quantity control both had orange focus | Row gets a subtle neutral context highlight; only the active minus/plus control gets strong focus. Arrow/column navigation and minimum quantities remain intact. |
| Editor minus remained in the remote ring after becoming natively disabled at one | Use an announced `aria-disabled` remote stop: decrement is a no-op at one, with a dim disabled glyph and a bright ring while focused. Normal review's natively disabled minimum remains unchanged. |
| Best cards retained orange borders; selected variants and progress circles used focus-like styling | Best remains a ribbon/label without a persistent focus border. Selected variants have a neutral treatment and `aria-pressed`. Current progress uses blue without orange glow. |
| Native focus stayed on an old carousel card or QR retry after remote movement | Synchronize native and logical focus before paint, including carousel index changes and QR Retry/Close navigation. Custom focused targets use one ring, with a native focus-visible fallback for other buttons. |
| A closing panel could retain focus while the replacement pairing/shopping panel opened | Closed panels become inert immediately and render no focus indicators, including confirmation strips, while retaining their internal navigation state. Browser checks scan both panels and exclude targets by actual visibility/clipping. |
| Delivered retained the vanished Refresh target | Delivered explicitly focuses Shop More. Validate navigation keys before paint when actions/model availability changes. |
| `scrollIntoView` shifted horizontal ancestors while the panel opened | Scroll only the panel body's vertical position. Use the full comparison/basket/ingredient focus surface so the outer card remains visible. |
| Ring transitions could retain the previous border/glow briefly | Remove ring/shadow transitions while retaining ordinary movement/background transitions. |
| Card focus relied on an invalid background shorthand with a solid color before another layer | Give category/dish/result cards an explicit bright border; confirmation chips also use a strong border. Visual checks require a real ring as well as a single focus target. |

All audited actionable screens have exactly one visible strong navigation focus. Moving focus removes the old outer treatment. Orange primary button fill is distinct from a focused button's ring. Selection, Best and progress states do not supply a second focus. This is a state/class/native-focus fix as well as a targeted CSS change, not blanket focus suppression.

## Cart and shopping outcomes

- Add to Cart retains the existing immediate My Cart / Preparing your cart transition for Food and Grocery. It does not clear the item being added.
- Shop More goes to Food/Grocery choice with the current vertical focused. It issues no cart-clear/checkout request and preserves a valid cart; Back can return to that cart.
- Only exact supported backend cart labels (including Cancel cart) open confirmation. Keep/Back sends nothing and preserves the cart. Confirm sends the original backend label once, guarded against duplicate dispatch.
- A clear is accepted only after an explicit empty-cart reply or a confirmed cart-clear result without order/payment evidence or failure. A checkout decline is not a cart clear or placed-order cancellation.
- Successful Food, Instamart and Zepto clears remove local rows, bill/envelope, actions, totals, selected cart items, editable draft/cache and old cart navigation history. The result screen shows the actual backend message plus Shop More. Back after shopping cannot resurrect the cleared cart.
- Unexpected order/payment evidence retains the existing Pay/tracking defense rather than becoming a cart-clear result.
- Failure/uncertainty leaves the cart intact. Recovery reads the provider cart; it does not replay the destructive label. Unrelated App-owned active-order state is preserved.

## Tracking reconciliation

The reported Instamart COD contract's explicit `{waiting:true, step:null, order_id:null, done:false}` response can retire a previously known Preparing/on-the-way order as Cancelled. This runs before monotonic progression, retains the known order ID, marks the snapshot terminal and stops automatic polls.

Inference is restricted to Instamart + explicit COD + prior active order ID/phase + this exact explicit absence shape. Mapper defaults, a fresh empty response, missing fields, mismatched order IDs, stale/error responses, other providers, online payment and payment-pending orders do not establish cancellation. Explicit Cancelled/Canceled statuses remain authoritative even if a heading still says Preparing.

No `/track` endpoint, payload or polling request contract changed. No checkout or destructive request is replayed automatically.

## File inventory

Paths relative to `tv-frontend`:

| File | Change |
| --- | --- |
| `docs/quickbite-final-frontend-audit.md` | Audit findings, outcomes, limits and validation |
| `scripts/frontend-regression.cjs` | Computed/visible focus checks, trace capture, retained 29 scenarios and audit orchestration |
| `scripts/final-frontend-audit.cjs` | Eleven additional browser scenarios and required 19 screenshots |
| `src/components/quickbite/ConfirmStrip.jsx` | Modal focus ownership, native focus and Tab containment |
| `src/components/quickbite/QrLoginPanel.jsx` | Coherent Retry/Close native and remote focus |
| `src/components/quickbite/QuickBitePanel.jsx` | Focus validation/scrolling, confirmed cart retirement, clean result and mode Shop More |
| `src/components/quickbite/screens/AgentCartScreen.jsx` | Subtle row context; quantity control owns strong focus |
| `src/components/quickbite/screens/BasketCompareScreen.jsx` | Single outer focus and separate Best label |
| `src/components/quickbite/screens/CompareScreen.jsx` | Outer card owns focus instead of a second inner ring |
| `src/hooks/useLiveOrderTracking.js` | Provide existing order/provider/payment evidence to reconciliation |
| `src/quickbite/cartState.js` | Defensive backend-confirmed cart-clear predicate |
| `src/quickbite/cartState.test.js` | Supported labels, explicit clear, decline/failure/order distinction |
| `src/quickbite/navigation.js` | Cleared-cart Back destination |
| `src/quickbite/tracking.js` | Guarded disappearance reconciliation and authoritative cancellation |
| `src/quickbite/tracking.test.js` | COD disappearance, false-cancellation guards, explicit status precedence |
| `src/quickbite/widgetScreens.js` | Recognize exact supported Cancel cart label |
| `src/styles/quickbite.css` | Focus/selection/Best/progress hierarchy and native fallback |

## Validation and evidence

- `npm test`: **79 passed, 0 failed**, retaining all 73 baseline tests and adding six meaningful unit tests.
- `node scripts/frontend-regression.cjs`: **40 mocked scenarios passed**, comprising all 29 baseline scenarios plus eleven Food/Grocery focus, agent-widget, cart clear/decline/failure/unexpected-order and tracking cases. **111 visible-focus snapshots** inspect computed strong rings, native focus ownership and clipping, not just `.is-focused` counts. Transition traces record screen, focusKey and focused DOM/styles.
- `npm run build`: **passed**, producing TV and mobile production assets; existing external Samsung `$WEBAPIS` warning is unchanged.
- `git diff --check`: **passed**.
- Chromium captures and visual inspection cover all 19 requested screenshots, numbered `01`–`19` under `/tmp/quickbite-final-audit`. That directory also contains `focus-evidence.json` and inspection sheets. These are workspace artifacts, not application assets.

Commerce responses and transcript delivery were mocked in the browser. No live Zomato/Instamart/Zepto/backend behavior was validated. Backend, OAuth/token persistence, MCP/provider infrastructure, Bixby/STT capture and API transport contracts were not changed. Existing provider/context isolation, mismatch/reconnect, tracking race/payment precedence, payment safety/redaction, compact editing and comparison Back restoration remain covered.
