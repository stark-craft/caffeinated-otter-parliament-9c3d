# CommAgent: TV shopping and phone pairing

CommAgent is a TV-first shopping interface. The TV plays content in the background; the viewer opens a side panel with the remote, pairs a phone by scanning a QR code, connects a merchant, and then shops by remote or voice. The browser version follows the same flow. The TV and phone screens are built together from the root `tv-frontend` folder; a separate QR frontend is **not** needed for the current combined build.

This README describes the **frontend contracts visible in this checkout**. The full commerce backend (`/api/session`, `/api/chat`, `/api/stt`, `/api/track`, merchant tools and LLM) is not present here. `qr_login/` contains the QR router, OAuth and in-memory storage source, but the complete server it imports and mounts into is also not present. The exact merchant/LLM internals therefore depend on the separately deployed backend. Examples below show fields the frontend sends or reads; they are illustrative, not a substitute for a live server response.

## The journey at a glance

```text
Open TV app
  ├─ choose USB-root tv-content.mp4, else packaged /video/tv-content.mp4
  └─ POST /api/session + check merchant connections
        ↓
Press Enter / remote OK → open QuickBite panel (the key itself makes no HTTP call)
        ↓
No merchant connected → POST /api/qr/session → display QR for /mobile/?session=…
        ↓
Phone validates session → confirms profile → connects merchant via OAuth
        ↓
Phone POSTs /api/qr/session/{id}/complete
        ↓
TV polling sees login_complete, refreshes merchant status and /api/session
        ↓
Shop locally through categories, or search/order through /api/chat
        ↓
Backend envelope → TV screen/card mapper → optional order tracking /api/track
```

The QR code is a **link**, not a token: it encodes the phone page URL and a pairing session ID. Merchant tokens stay on the backend. The TV does not unlock solely because the phone displays a success animation; it checks actual merchant connection status.

## Which folder runs what?

| Path | Purpose |
| --- | --- |
| `tv-frontend/` | Active Vite project: TV app at `/`, phone setup at `/mobile/`, one `dist/` build. |
| `tv-frontend/src/App.jsx` | TV orchestration: commerce session, QR pairing, merchant gates, voice transcript routing, `/api/chat`. |
| `tv-frontend/src/components/VideoPlayer.jsx` and `src/tizen/usbVideo.js` | USB/packaged video, autoplay/loop, remote keys, side-panel layout. |
| `tv-frontend/src/components/quickbite/QuickBitePanel.jsx` | Shopping screens, remote focus, menu/cart/order interactions. |
| `tv-frontend/src/quickbite/` | Local catalogue/navigation, intent routing, request context and envelope-to-card mapping. |
| `tv-frontend/mobile/` | Active phone pairing pages included in the same Vite build. |
| `qr_login/` | QR API/OAuth/storage source expected to be mounted into the separate FastAPI backend. |
| `qr_login/mobile-frontend/`, `qr_login/tv-frontend/` | Preserved earlier standalone frontends; the active combined flow uses `tv-frontend/mobile/`. |
| `backend/`, `core/`, `mcp_clients/`, etc. | Existing project directories; the full commerce server implementation is not included in this checkout. |

## Start, video and remote behavior

1. On page load, the TV calls `POST /api/session` with `device: "tv"`. It reuses a previously saved `ca_sid` from browser local storage when available, and stores the returned `session_id`. The server response may also supply `platforms` and active order `tracking`.
2. It checks `GET /api/qr/auth/status/{merchant_id}` for `zomato`, `swiggy` and `zepto`. While the panel is open, those checks repeat every 15 seconds. A connected Zomato or Swiggy account unlocks food; a connected Zepto or Swiggy account unlocks grocery. The platform list from `/api/session` is a fallback source of connection information.
3. On Samsung/Tizen, `usbVideo.js` looks only in the **root** of mounted removable storage for a file named `tv-content.mp4`. If absent—or if that source fails to play—the player uses `/video/tv-content.mp4` (or `VITE_TV_VIDEO_SRC`). In a desktop browser there is no Tizen USB filesystem, so the packaged URL is used directly. Supply a real file at one of those locations; otherwise the page says “TV content unavailable.”
4. The `<video>` has autoplay and loop enabled. Chrome may block playback with sound, so the player retries muted. If a video still cannot autoplay, a user gesture/browser policy is required. When the side panel opens, the video is displayed in a smaller viewing area without changing its aspect ratio; its surroundings sample colors from the current frame when allowed.
5. Press **Enter** on a keyboard or **OK/Select** on a Samsung remote to open the side panel. This keypress is local UI state: **it does not call an API**. Opening an unauthenticated panel then triggers QR session creation (below). Remote Back/Escape closes or navigates the panel; arrows and Enter are forwarded to the panel while it is open. Media remote keys still control playback.

## Pairing and merchant login, step by step

These routes have the `/api/qr` prefix. The TV API and phone API use the same backend origin; during development the root Vite server proxies `/api` to the configured backend.

| Stage | Caller and exact route | What the frontend uses |
| --- | --- | --- |
| Create pairing | TV `POST /api/qr/session` with `{}` | Receives `session_id`; renders a QR pointing to `/mobile/?session=<id>`. The QR route can optionally accept a supplied ID, but the active TV sends an empty object. |
| Open phone page | Phone `GET /mobile/?session=<id>` | Static frontend route, **not** a backend API call. The URL must be reachable from the real phone. |
| Validate scan | Phone `GET /api/qr/session/{id}/validate` | Requires `{ "valid": true }`; retries up to five times, 1.5 seconds apart. Invalid/expired sessions are rejected by the phone UI. |
| Prefill details | Phone `GET /api/qr/user/profile` | Reads profile fields such as `name`, `phone`, `vpa`. The phone page shows name/phone as read-only and lets the viewer edit the UPI ID. |
| Save details | Phone `POST /api/qr/user/profile` | Sends `{ "name": "…", "phone": "…", "vpa": "…" }`. The current phone UI treats a save failure as non-fatal and still advances. |
| Check existing login | Phone and TV `GET /api/qr/auth/status/{merchant_id}` | Reads `connected: true/false` for `zomato`, `swiggy`, `zepto`. A pending forced reconnect reports disconnected until the new callback finishes. |
| Start merchant OAuth | Phone `POST /api/qr/auth/begin` | Sends `{ "merchant_id": "zepto", "force": false }` (or `force: true` on reconnect). A cached token yields `status: "connected"`; otherwise `status: "pending"` and an `auth_url` opened in a new phone tab. |
| Receive OAuth callback | Merchant redirects to backend `GET /api/qr/auth/callback?code=…&state=…` | Used by Swiggy/Zepto in the QR router source. Zomato uses its separate loopback listener on port 9876. The phone polls auth status every 2 seconds until connected. |
| Optional code fallback | `POST /api/qr/auth/complete` | Router supports a pasted authorization code/redirect URL, but the active combined phone UI does **not** call this route. |
| Finish pairing | Phone `POST /api/qr/session/{id}/complete` | Sets `login_complete`; the phone then advances to its success screen. |
| Detect completion | TV `GET /api/qr/session/{id}/status` every 2 seconds while pairing | On `login_complete: true`, TV refetches merchant statuses and `POST /api/session`. It opens shopping only if the requested vertical has a real connected merchant. |
| Health probe | `GET /api/qr/health` | QR router diagnostic route; not part of the normal TV/phone UI flow. |

The QR source in this checkout stores one session and its completion flag **in memory**; it does not implement a time-based expiry. A backend restart or a second pairing can invalidate the prior ID. The phone success screen changes its “synced” label after a local timer; the authoritative unlock check remains the TV's status/merchant polling.

For example, a QR creation response contains an ID:

```json
{ "session_id": "AGC-EXAMPLE123" }
```

The TV encodes a URL like `https://your-phone-host.example/mobile/?session=AGC-EXAMPLE123` in the QR graphic. That hostname is an example; the real URL comes from `VITE_MOBILE_APP_URL` (or the current origin in development). A packaged WGT on the TV does **not** host pages for phones, so `/mobile/` still needs a phone-reachable HTTP(S) host serving the same build.

## Shopping, speech and LLM data flow

There are two distinct kinds of navigation:

- **Local navigation:** Enter/OK, remote arrows, and recognized labels such as “open food,” “order banana,” or “show groceries” move through the QuickBite UI without calling `/api/chat`. The labels are defined in `tv-frontend/src/quickbite/voiceNavigation.js`; comparison is normalized for capitalization and punctuation. If the requested merchant vertical is locked, the QR panel appears instead.
- **Backend work:** Searches, comparisons, menu fetches, cart actions and order actions use the existing commerce session and `POST /api/chat`. The app sends the user utterance or the selected backend-provided action label; it does not have a separate `/api/payment` call. Some intent decisions (for example an unclear reference or a payment-in-progress guard) stay local and show a confirmation strip rather than sending a request.

In Chrome, holding a digit **1–9** or **PageDown** starts microphone capture; releasing it sends recorded audio as multipart `file` to `POST /api/stt` (plus optional JSON `keyterms` from the visible catalogue/view). The response's `transcript` and `language` go to `handleTranscript(transcript, language)`. On Samsung TV, the Bixby voice-key adapter and available Samsung/SpeechRecognition paths deliver text into that **same** handler. The STT/voice source changes, but the commerce pipeline does not. Browser microphone permission and a secure context/`localhost` are required; physical-TV voice APIs must be verified on the device.

`handleTranscript` first checks the local label map. If no label matches, it derives an intent and a bounded snapshot of the current screen (`view`: screen, vertical, widget, focus, revision and up to 12 visible items). The intent router decides whether the app should act locally, ask for confirmation, or call the backend. For a search, `searchPrompt` preserves the full utterance and appends the connected merchant scope. The request to the backend is structurally:

```json
{
  "session_id": "<commerce-session-id>",
  "message": "order paneer tikka\n\n[Platforms: …]",
  "view": { "screen": "home", "vertical": "food", "widget": "message", "items": [] }
}
```

The exact `view` also contains focus, cart/order flags and a revision; the actual `message` suffix depends on connected merchants. `POST /api/chat` is the boundary to the separate commerce backend and its LLM/tools. The frontend receives a **rendering envelope**, not the LLM's internal raw answer. For example, an illustrative food result is:

```json
{
  "widget": "carousel",
  "text": "Found nearby choices.",
  "actions": [],
  "payload": {
    "kind": "food",
    "cards": [
      { "name": "Example Kitchen", "platform": "Zomato", "rating": 4.5 }
    ]
  }
}
```

`screenForEnvelope` chooses the TV screen from `widget` and `payload.kind`: food/dish/restaurant-match carousels become restaurant cards; grocery carousels become product results; `menu`, `cart`, `comparison`, `basket`, `basket_stocked`, `spend_report`, `text` and `message` have their own mappings. Missing or unrecognized data falls back to a text screen. The mappers read item names, prices, platform and image URLs from the envelope. Clicking a restaurant can request its menu via another `/api/chat`; selecting items and backend-supplied actions continues through that same endpoint. The UI does not manufacture a payment method or alter the backend-provided action string.

When an envelope includes a `tracking` descriptor, the TV saves it as the active order and calls `POST /api/track` with `{ "session_id": "…", "tracking": { … } }`. It polls about every 20 seconds for up to 45 minutes (or until done/cancelled), and can refresh manually. A payment QR/image may be read from the envelope or tracking response. The backend remains the source of truth for order, payment and delivery state.

## API reference by caller

All routes in this table are relative to the backend origin. `tv-frontend/src/api.js` and `tv-frontend/mobile/src/services/api.js` are the frontend sources of truth for request construction.

| Route | Used by | Purpose |
| --- | --- | --- |
| `POST /api/session` | TV | Create/restore a commerce session; send `session_id` and `device: "tv"`. |
| `POST /api/chat` | TV | Send a user request, selected action or follow-up plus session/view; receive UI envelope. |
| `POST /api/stt` | TV browser voice | Transcribe microphone audio; `multipart/form-data` with `file`, optional `keyterms`. |
| `POST /api/track` | TV | Refresh a live order from a tracking descriptor. |
| `POST /api/qr/session` | TV | Create QR pairing ID. |
| `GET /api/qr/session/{id}/status` | TV | Poll phone completion. |
| `GET /api/qr/auth/status/{merchant_id}` | TV, phone | Check cached/pending merchant connection. |
| `GET /api/qr/session/{id}/validate` | Phone | Verify scanned QR session. |
| `GET /api/qr/user/profile` / `POST /api/qr/user/profile` | Phone | Prefill and save setup details. |
| `POST /api/qr/auth/begin` | Phone | Start merchant OAuth or reuse a valid cached token. |
| `GET /api/qr/auth/callback` | Merchant → backend | OAuth redirect for providers using the router callback. |
| `POST /api/qr/session/{id}/complete` | Phone | Mark phone setup complete for TV polling. |
| `POST /api/qr/auth/complete` | Supported by QR router, inactive in combined phone UI | Manual authorization-code fallback. |

`tv-frontend/src/api.js` also exports `POST /api/auth/begin`, `/api/auth/complete`, `/api/llm`, `/api/addresses`, and `/api/address` helpers. The current `App.jsx`/QuickBite flow does **not** invoke them. They should not be confused with the active `/api/qr/auth/*` phone-login routes.

## Running the frontend

From `tv-frontend/`, install dependencies once and run `npm run dev`; Vite normally serves the TV at `http://localhost:5174/` and the paired phone UI at `/mobile/`. `npm run build` creates a single `dist/` with both `index.html` and `mobile/index.html`. For a real phone, open the TV's dev page via the Mac's LAN address rather than `localhost` so the QR URL is reachable by the phone. Both the TV/browser and phone must reach the backend, and the phone host must serve `/mobile/`.

The root Vite development proxy routes `/api` to the backend configured in `tv-frontend/vite.config.js`. In a packaged/production build, the TV API origin comes from `VITE_API_BASE_URL`; the QR's phone-page origin can be set with `VITE_MOBILE_APP_URL`. These are build-time Vite variables, not runtime secrets. The older standalone QR frontends have their own package files but are not needed for the combined TV/mobile build.

No video or backend service is bundled in this source snapshot. If the configured backend is down, the TV can still render but pairing, speech transcription and live commerce calls will fail. If no USB or packaged `tv-content.mp4` is supplied, the video-unavailable placeholder is expected. Do not commit OAuth credentials, tokens, local `.env` files or build output when deploying or contributing.
