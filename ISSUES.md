# CommAgent issues and remediation record

This is an evidence-based record for the reconstructed CommAgent checkout, not an assignment of blame. It distinguishes confirmed frontend defects from requested product/UI changes and from problems that cannot be validated until the backend and a Samsung TV are available. “Fixed” means the current local checkout contains a code change; it does **not** mean the complete merchant flow has passed a live end-to-end test. The fixes described below are local and may not yet be committed or deployed.

## Executive summary

| Area | What was wrong or missing | Current position |
| --- | --- | --- |
| Commerce envelopes | Loading and response routing could show the wrong screen or lose action buttons | Frontend logic corrected; unit-tested |
| Checkout | A failed/uncertain response could replay a potentially chargeable action | Automatic replay removed; read-only reconciliation used |
| Payment | Platform name was used as a substitute for actual payment evidence; a real QR could be hidden | Payment display now prefers backend QR/payment data |
| Tracking | “Out for delivery” could be classified as “delivered” | Status parsing corrected; unit-tested |
| Platform attribution | Provider was not consistently visible after selection | Offline branded badges added through payment/tracking |
| QR/backend | QR Python router, OAuth and storage files in this checkout fail syntax parsing; full commerce server is absent | **Open blocker** |
| Physical TV/provider flows | Bixby, USB video, OAuth, payment and tracking cannot be proven from a frontend build | **Needs device + backend testing** |

## Confirmed frontend defects addressed

### 1. A pending voice request showed a restaurant screen before the answer existed

- **Symptom:** A voice search could show “Choose a Restaurant” with a loader while the backend might actually return a grocery list, menu, cart, comparison or plain answer. This was especially confusing during the wait before the response arrived.
- **Cause:** The loading view was selected from an early guess about the request rather than the backend envelope's actual widget/kind.
- **Fix applied:** The pending state now uses a neutral loading view. The real response is routed only after the envelope arrives. See [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx) and [widgetScreens.js](tv-frontend/src/quickbite/widgetScreens.js).
- **Verification:** Unit tests cover envelope routing in [widgetScreens.test.js](tv-frontend/src/quickbite/widgetScreens.test.js). A live LLM response still needs checking.

### 2. Unexpected envelope shapes could render as the wrong kind of card

- **Symptom:** Unknown or nested response shapes could fall through to restaurant cards, including grocery/cart data appearing under “Choose a Restaurant.” Text replies could lose backend-provided action buttons or appear as an empty/retry screen.
- **Cause:** UI routing did not consistently inspect nested `payload.data.kind`, and fallback handling did not preserve top-level `actions` or valid plain text.
- **Fix applied:** A single widget-to-screen registry handles known kinds and sends unknown/empty structures to a safe text view. Nested carousel kinds and text actions are covered. See [widgetScreens.js](tv-frontend/src/quickbite/widgetScreens.js).
- **Verification:** Fixture and edge-case tests pass in [widgetScreens.test.js](tv-frontend/src/quickbite/widgetScreens.test.js). These tests validate frontend parsing, not every response the live backend may produce.

### 3. Checkout could submit the same order action twice

- **Symptom:** After a network error or malformed response, the cart's “Retry” path could send the last checkout action again. If the first request reached the provider but its response was lost, the second request could place or charge for a duplicate order. Rapid repeated OK presses were another risk before React updated the loading state.
- **Cause:** Retry reused the exact backend action string, and the UI-state-only busy flag was not an atomic in-flight guard.
- **Fix applied:** Checkout now has an immediate in-flight guard. An uncertain checkout result is labelled as uncertain; “Review cart” sends a **read-only** cart request through the existing `/api/chat` path instead of replaying the order/payment action. The user is told to verify the provider's order status before deliberately placing another order. See [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** Static audit and build completed. A provider-side idempotency guarantee is still needed for true duplicate-order protection; the frontend alone cannot provide it.

### 4. Payment UI asserted cash on delivery without payment evidence

- **Symptom:** A non-Zomato order could be labelled “Cash on delivery” solely because of its platform, even if the backend had supplied a payment QR. Conversely, a later tracking step could show “Payment received” for a COD order.
- **Cause:** The pay screen used a platform-name shortcut as the source of truth for payment method.
- **Fix applied:** A backend-supplied QR takes precedence. Explicit COD/cash data produces the COD view; explicit UPI/online data produces the QR view; absent evidence stays neutral. The later confirmation headline no longer claims money was received for COD or unknown payment methods. See [payMode.js](tv-frontend/src/quickbite/payMode.js) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** Decision rules are tested in [payMode.test.js](tv-frontend/src/quickbite/payMode.test.js). Actual payment confirmation must still come from the backend/provider.

### 5. Payment QR extraction was too narrow in one place and too broad in another

- **Symptom:** The TV originally looked only at the last `images` entry for a payment QR, missing explicit `payment_qr`/`qr` fields. In a generic widget response, that same fallback could mistake an ordinary product image for a payment QR and navigate to payment.
- **Cause:** QR extraction did not prioritize explicit payment fields or account for the context in which images were returned.
- **Fix applied:** Explicit QR fields in the envelope, payload and tracking descriptor are checked first. Top-level and nested tracking descriptors use the same extraction path. The legacy image fallback remains for checkout/tracking responses, but generic widget replies do not treat their images as payment QR codes unless an order-tracking descriptor is present. Polling can replace an older QR with a newer provider QR. See [envelopes.js](tv-frontend/src/quickbite/envelopes.js), [App.jsx](tv-frontend/src/App.jsx), [useLiveOrderTracking.js](tv-frontend/src/hooks/useLiveOrderTracking.js) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** QR extraction tests pass in [envelopes.test.js](tv-frontend/src/quickbite/envelopes.test.js). The frontend **displays** a backend-provided payment QR; it does not manufacture a payable QR if the backend sends none.

### 6. A new QR-only checkout could inherit a previous order's tracking

- **Symptom:** If a new checkout returned a QR but no tracking descriptor, an older active order's status or QR could remain visible. The refresh control could also appear to work while checking the wrong order.
- **Cause:** The TV kept the prior `activeOrder` until a new tracking descriptor arrived.
- **Fix applied:** A QR-only response clears the previous active order, uses its own QR first, suppresses old tracking data and displays a clear “tracking reference not returned” warning rather than a no-op refresh button. See [App.jsx](tv-frontend/src/App.jsx) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** Frontend build passes. A live QR-only checkout response is still needed to exercise this path end to end.

### 7. “Out for delivery” was displayed as “Delivered”

- **Symptom:** An order whose status was `Out for delivery` could jump to the completed-delivery screen before arriving.
- **Cause:** The parser used a broad substring check for `deliver`, which also matched `delivery`. The cancellation check similarly treated any phrase containing `cancel` as already cancelled.
- **Fix applied:** Delivery and cancellation now use completion-specific status terms; “out for delivery” stays on the on-the-way screen. Polling also stops when a delivered status is reached, not only when a separate `done` flag appears. See [tracking.js](tv-frontend/src/quickbite/tracking.js) and [useLiveOrderTracking.js](tv-frontend/src/hooks/useLiveOrderTracking.js).
- **Verification:** Regression cases pass in [tracking.test.js](tv-frontend/src/quickbite/tracking.test.js). Provider-specific status vocabulary beyond those cases still requires sample payloads.

### 8. The frontend invented merchant platforms when source data omitted them

- **Symptom:** A restaurant with no platform could silently become “Zomato,” a grocery item could silently become “Zepto,” and reopening a cart could default to Zepto. That risks sending a valid-sounding request to the wrong provider.
- **Cause:** Hard-coded fallbacks were used in commerce prompts rather than treating missing platform attribution as an error.
- **Fix applied:** Menu/cart requests now fail visibly when the platform is missing; the read-only cart path no longer defaults to Zepto. The order platform is selected from the current cart/store or current vertical, not an unrelated old selection. See [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx) and [payMode.js](tv-frontend/src/quickbite/payMode.js).
- **Verification:** Build and pure platform-precedence tests pass. The backend must still supply correct platform values for useful cards.

### 9. Menu errors did not have a working Retry button

- **Symptom:** The menu error state passed a focus value to the error component but not the retry callback, leaving an apparent retry state with no working action.
- **Cause:** Incorrect props were passed to the shared error component.
- **Fix applied:** The menu error state now passes the retry handler and focus props. See [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** Source/build check; a live failed-menu request has not been exercised.

### 10. Provider identity disappeared during the ordering journey

- **Symptom:** Platform text appeared on some result cards, but provider identity was not consistently prominent on food items, cart lines, payment, confirmation and tracking. Users could not reliably tell whether an item/order came from Zomato, Swiggy, Zepto or Instamart.
- **Cause:** Each screen rendered its own small subset of platform fields; there was no shared visual treatment.
- **Fix applied:** A reusable, offline-rendered platform badge/lettermark was added from restaurant/product selection through menus, review, cart, payment, confirmation, delivery tracking and cancellation; comparison and basket widgets also show it. Unknown platform stays visibly unknown rather than being fabricated. See [PlatformBadge.jsx](tv-frontend/src/components/quickbite/PlatformBadge.jsx), [PlatformBadge.css](tv-frontend/src/components/quickbite/PlatformBadge.css) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** Build passes. These are **branded local lettermarks and names, not licensed official logo image assets**; official artwork was not supplied in this checkout.

### 11. Remote Back could skip the actual previous screen

- **Symptom:** Selecting a dish from a restaurant menu opened item review, but Back went to the restaurant list instead of that menu. Direct voice/widget jumps and tracking transitions had the same fixed-parent problem.
- **Cause:** Back relied on a static screen-parent map, with only a one-step special case for voice jumps.
- **Fix applied:** The panel records actual visited screens and pops that history on Samsung Back or keyboard Backspace. A temporary voice-loading screen is replaced by its result rather than inserted into history. Automatic tracking advancement is held at the previous view after Back until the live phase changes. The fixed map remains a fallback for screens opened without history. See [navigation.js](tv-frontend/src/quickbite/navigation.js) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** History and remote key mappings have unit tests; device-level traversal still needs testing.

### 12. QR pairing actions were not fully remote-navigable

- **Symptom:** The TV remote could close the QR pane with Back, but arrows did not select between “Try pairing again” and “Close”; OK retried regardless of which action appeared selected.
- **Fix applied:** Arrow keys now select a visible action, OK activates it and Back closes the pane. The selected action has a focus ring. See [QrLoginPanel.jsx](tv-frontend/src/components/quickbite/QrLoginPanel.jsx) and [QrLoginPanel.css](tv-frontend/src/components/quickbite/QrLoginPanel.css).

### 13. Structured COD success without tracking was labelled as checkout failure

- **Symptom:** A provider response with an explicit cash-on-delivery method, order ID and placed/confirmed status—but no tracking descriptor or QR—fell into the uncertain-error branch. Returning to the cart after a successful checkout could also expose action labels again.
- **Fix applied:** That narrow, structured COD result reaches the COD screen with an honest no-tracking warning. Responses without all three pieces of evidence remain uncertain. Once an order is submitted, checkout actions are suppressed until a new cart journey starts. See [payMode.js](tv-frontend/src/quickbite/payMode.js) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** COD decision cases are unit-tested. The actual provider response still must be checked against this shape.

### 14. Tracking ETA variants and failed QR images lacked handling

- **Symptom:** Tracking displayed only a direct `eta` field, so a nested `delivery_eta` or numeric `eta_minutes` could be omitted. A payment QR image that failed to load had no visible error and still invited a scan.
- **Fix applied:** Tracking normalization preserves those known ETA variants; the payment screen reports QR image load failure and can display a later replacement QR. See [tracking.js](tv-frontend/src/quickbite/tracking.js) and [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx).
- **Verification:** ETA variants are unit-tested. Image rendering and QR scannability still need a real provider response and physical screen.

## Earlier browser walkthrough and reconstruction findings

The items here were observed or requested during reconstruction. Some were product-design requests, not proof that the original Windows code was defective. They are included so the history does not get misrepresented.

### 11. Missing or empty pasted components prevented startup

- **Observed:** The browser reported `VoiceOverlay.jsx` did not provide a default export. The QuickBite panel was also missing until its four supplied parts were provided. A missing `/favicon.ico` produced a separate 404.
- **Impact:** A missing module export can prevent the entire TV UI from loading; a missing favicon is only console noise.
- **Resolution/status:** The supplied voice/panel code was reconstructed and the TV frontend now builds. This was a **reconstruction completeness issue**, not evidence that the source on the original machine was broken. The favicon asset is still not present.
- **Evidence:** [VoiceOverlay.jsx](tv-frontend/src/components/VoiceOverlay.jsx), [QuickBitePanel.jsx](tv-frontend/src/components/quickbite/QuickBitePanel.jsx), [index.html](tv-frontend/index.html).

### 12. The TV view had demo controls and prompts the product no longer wanted

- **Observed:** The walkthrough showed shopping suggestion chips, a progress bar, play/pause/seek/speed controls and other chrome on top of TV content.
- **Change requested:** A clean TV viewing surface, with the shopping panel opened by Enter/OK rather than an on-screen “Shop” chip.
- **Resolution/status:** The current [VideoPlayer.jsx](tv-frontend/src/components/VideoPlayer.jsx) renders a bare `<video>` with `controls={false}` and no chip/control row. Keyboard/remote keys still handle media actions. This is a **UI requirement change**, not automatically a code defect.

### 13. Remote OK/Back and the panel/video layout needed TV-specific handling

- **Observed:** The panel initially overlaid or squeezed the content, and the browser walkthrough asked for Enter/OK opening, Back/navigation support, aspect-ratio-preserving shrinkage, ambient color, rounded edges and panel margins.
- **Resolution/status:** [tvRemoteKeys.js](tv-frontend/src/tizen/tvRemoteKeys.js) maps Samsung key codes; [VideoPlayer.jsx](tv-frontend/src/components/VideoPlayer.jsx) forwards navigation keys and samples video color; [tv-view.css](tv-frontend/src/styles/tv-view.css) sizes the video using its actual aspect ratio and gives both view and panel spacing/rounded corners. Physical-device appearance remains unverified.
- **Important distinction:** These were deliberate product/UI requirements during the walkthrough. They should not be presented as a regression in the original source without comparing against the actual Windows build.

### 14. Video source and autoplay behavior were not self-contained

- **Observed:** The browser showed “TV content unavailable” because neither a Tizen USB source nor the packaged fallback video was present in this checkout. The requested playback behavior was autoplay and continuous loop.
- **Resolution/status:** [VideoPlayer.jsx](tv-frontend/src/components/VideoPlayer.jsx) has autoplay, loop and an `onEnded` restart. [usbVideo.js](tv-frontend/src/tizen/usbVideo.js) searches the USB root for `tv-content.mp4` and falls back to the packaged URL. Chrome may require muted autoplay or a user gesture. **The media file itself is still missing**, so the empty-state message is expected until an asset is supplied.

### 15. QR onboarding and the mobile page were separate from the main TV journey

- **Observed:** The initial “0 connected”/settings entry and separate QR TV frontend did not match the desired flow: unauthenticated users should see pairing when opening QuickBite, then unlock the requested shopping vertical only after merchant connection.
- **Resolution/status:** The root TV app now creates/polls a QR session, checks merchant auth status and uses the mobile page in one Vite project/build. See [App.jsx](tv-frontend/src/App.jsx), [QrLoginPanel.jsx](tv-frontend/src/components/quickbite/QrLoginPanel.jsx), [merchantAccess.js](tv-frontend/src/quickbite/merchantAccess.js) and [vite.config.js](tv-frontend/vite.config.js). The browser screenshot also showed a `/session` HTTP 500 during a period when the backend was unavailable; that screenshot alone does not identify a frontend or backend root cause.
- **Verification:** Frontend build passes. Scanning, OAuth and unlock still need a running server and real phone.

### 16. Browser and Samsung voice needed one transcript boundary

- **Observed:** Chrome hold-to-talk had previously stopped responding to the digit key during reconstruction; Samsung/Bixby voice handling was also at risk of duplicate `XF86BTVoice` listeners and case-sensitive label matching.
- **Resolution/status:** Chrome [useVoiceKey.js](tv-frontend/src/hooks/useVoiceKey.js) uses held digit 1–9 or PageDown and sends audio to `/api/stt`; Samsung [useSamsungVoice.js](tv-frontend/src/hooks/useSamsungVoice.js) owns the `XF86BTVoice` lifecycle. Both deliver text into `App.handleTranscript`, with case/punctuation-normalized local labels and backend fallback for unmatched speech. Diagnostic logging was added along the transcript, backend and envelope path. See [voiceNavigation.js](tv-frontend/src/quickbite/voiceNavigation.js), [bixbyVoice.js](tv-frontend/src/tizen/bixbyVoice.js) and [voiceDiagnostics.js](tv-frontend/src/quickbite/voiceDiagnostics.js).
- **Verification:** Source/unit tests cover key registration and label normalization. Bixby capture and Samsung microphone behavior **still require a physical TV**; a desktop build cannot prove those APIs work.

## Open blockers and risks that should not be called fixed

### A. The QR Python source in this checkout cannot be imported

- **Evidence:** [routes.py](qr_login/routes.py), [oauth.py](qr_login/oauth.py) and [storage.py](qr_login/storage.py) are each flattened into a single line. A read-only Python AST parse of each fails with `SyntaxError`.
- **Impact:** The QR API cannot start from these exact files, regardless of whether the TV/mobile frontend builds.
- **Action required:** Restore the original newline/indentation-preserving Python sources, then syntax-check and run the QR API with its real dependencies. Do not guess indentation by formatting the flattened text. This could be a copy/reconstruction artifact; the available evidence does not prove the original Windows files were malformed.

### B. The complete commerce backend is not in this repository checkout

- **Evidence:** The backend/core/MCP directories contain no server implementation here; the frontend calls `/api/session`, `/api/chat`, `/api/stt` and `/api/track` but their complete handlers are not present. See [README.md](README.md) and [api.js](tv-frontend/src/api.js).
- **Impact:** The working frontend build cannot establish that restaurant search, checkout, provider payment QR or tracking really succeeds against a deployed backend.
- **Action required:** Supply/run the compatible backend, capture representative redacted envelopes and perform end-to-end tests for COD, Zomato UPI QR, failed checkout and each delivery state. Do **not** add guessed endpoints to the frontend.

### C. QR session storage has a single global session/completion flag

- **Evidence:** [storage.py](qr_login/storage.py) defines one `_session_id` and one `_login_complete`; [routes.py](qr_login/routes.py) returns `is_login_complete()` from `/session/{session_id}/status` without checking the requested ID.
- **Impact:** If restored as written, a second TV pairing can replace the first, and completion is not scoped to a particular session. The source also has no persistence or time-based expiry. This is a **static design risk** because the pasted Python currently cannot run.
- **Action required:** Backend owners should implement per-session state and validate the ID in status/completion routes before multi-TV or production use.

### D. The phone can display success before the TV is actually synced

- **Evidence:** [UserDetails.jsx](tv-frontend/mobile/src/pages/UserDetails.jsx) proceeds even if profile save fails. [MerchantLogin.jsx](tv-frontend/mobile/src/pages/MerchantLogin.jsx) proceeds even if `completeSession` fails. [SuccessScreen.jsx](tv-frontend/mobile/src/pages/SuccessScreen.jsx) displays “Synced to TV” after a local 1.5-second timer rather than a TV/backend acknowledgement.
- **Impact:** The phone may claim completion while the TV is still locked or profile details were never saved. This is a confirmed code-level risk, not yet fixed in this issue-log task.
- **Action required:** Make success conditional on authoritative backend/TV state and show actionable retry/error states. Confirm the intended product policy before changing whether a failed profile save must block progression.

### E. A single TV build does not make the mobile URL phone-reachable

- **Evidence:** [vite.config.js](tv-frontend/vite.config.js) produces TV and `/mobile/` pages in one build, but the QR contains a URL the **phone** must fetch. A packaged Samsung WGT is not an HTTP server for phones. See [README.md](README.md) and [QrLoginPanel.jsx](tv-frontend/src/components/quickbite/QrLoginPanel.jsx).
- **Impact:** Pairing can still fail if `VITE_MOBILE_APP_URL`/the built mobile page is not served over a phone-reachable network address.
- **Action required:** Host the same build's mobile page on a reachable HTTP(S) origin and verify QR URL, CORS/HTTPS and API reachability from a real phone.

### F. Demo media/hero assets and official merchant logo files are absent

- **Evidence:** [heroArt.js](tv-frontend/src/quickbite/heroArt.js) references `/images/hero/...`, and [usbVideo.js](tv-frontend/src/tizen/usbVideo.js) references a packaged video, but `tv-frontend/public/` currently has no such files. There is no favicon or supplied official merchant-logo artwork.
- **Impact:** The browser shows fallbacks or 404s; the app cannot display the intended cricket clip or exact brand assets from this checkout alone.
- **Action required:** Supply and license the intended video/hero/logo assets. The new local platform badges remain visible without them.

### G. Physical-device behavior and payment remain unproven

- **Evidence:** Unit tests and Vite compilation do not exercise Samsung `webapis`, USB filesystem permissions, Bixby key capture, microphone/STT, OAuth callbacks, provider checkout, QR payment confirmation or live rider updates.
- **Action required:** Run a test matrix on the target Samsung model and a real phone: Enter/OK/Back, Bixby known/unknown utterances, USB and packaged video, pairing, merchant reconnect, Zomato UPI QR, explicit COD, checkout timeout without duplicate order, `out for delivery`, delivered and cancelled. Save redacted request/response examples for each failure.

## Verification performed in this checkout

- `npm test` in `tv-frontend/`: **39 tests passed** (including envelope, payment, tracking, Samsung key and navigation cases).
- `npm run build` in `tv-frontend/`: **passed**, producing TV and mobile pages. Vite reports the existing `$WEBAPIS/webapis/webapis.js` non-module script warning; it does not fail the build and must be checked in the Tizen package/device environment.
- `git diff --check`: **passed**.
- No backend, provider or physical-TV end-to-end test has been completed here. A green frontend build is not proof that the full product works.
