# Universal Guide home adapter

Presentation is taken from `stark-craft/fictional-space-spoon`, main commit `b3e5c2d30f260d078a8beabdfc7e927071fa7089`. `reference.css` retains the original declarations and cascade for the home, cards, rails, typography, focus borders, and motion. Focus selectors also cover programmatic remote focus. Selectors and animation names are scoped to protect the existing commerce and video UI. Styles for removed features are omitted.

`universalGuide.css` contains only the integration: persistent video, home/video view transitions, the existing three hero promotions, screen shrinking, rounded corners, backdrop, and safe rail overflow. The original video component and Quick Shop files remain untouched.

## Complete reference catalogue

The extra Recent card is omitted from Now Playing; no other card limits are applied. Row order, card order, image fallbacks, logo sizing, poster shapes, and metadata match the source.

- For You: Now Playing (1 video), Recommended for You (7), Apps (7 ATF + 9 BTF), Sponsored Row (9), Search Trends (15), Prime Video (13), IMDb Top 10 (10), Continue Playing (8), Comedy Movies (15), War Movies (11), Drama Movies (15), Sci-Fi Movies (14), Media Output (4).
- Live: On Now (12), Live Sports (2 IPL + 2 FIFA), Trending Channels (8), News & Opinion (10), Entertainment (10), TV Plus Movie Channels (10).
- Apps: Recommended (8), Promotional Row (11), Editor's Choice (9), Sports (6), Lifestyle (6), Popular This Week (9), What's New (5), Genre (6), Media Output (4).

Now Playing contains only the existing video. Right moves directly into Recommended for You. The video remains mounted during tab changes and when entering/leaving its full view.

## Actions and navigation

Ordinary cards and sidebar controls are display-only, with keyboard focus and the original visual focus treatments. Sponsored cards retain their visual labels without activating an action. No home QR, detail overlays, AI trip planner, personalization, simulated score updates, or Tizen app launching is imported.

Arrow keys traverse every card and row. Horizontal rails and the main feed scroll independently to reveal the focused card and its heading; focus recovers after a browser or overlay drops it. Hero resizing keeps the focused area visible. Sponsored/sports rails center it as in the reference. Up from the tabs expands the hero and Down collapses it. The hero continues its six-second rotation, including while the shop panel is open.

Only Amul Milk 1 L and Coca-Cola 1 L hero promotions open the existing Quick Shop. Back closes that panel and restores the full home frame and focus. Now Playing opens the original full video view; Enter there uses the existing shop flow. Back closes the video-view panel through the original dispatcher, and a subsequent Back returns to home. `?home=classic` still opens the original player directly.

## Direct product promotions

Clicking either product banner uses the existing Grocery QR pairing first when needed. After Grocery unlocks, the hook sends one `grocery-shortcut` panel request. The panel uses the existing `sendSilent` / `/api/chat` search and opens quantity review directly, rather than the local catalogue or store/brand picker. Its payment guard still runs before discovery.

`src/quickbite/groceryShortcut.js` defines the fixed products and matches normalized offers. Milk must be Amul milk in one 1 L pack (1000 ml is equivalent); Coca-Cola must be the regular drink in one 1 L pack, excluding diet/zero variants. Selection requires explicit `in_stock: true`, a numeric price and a recognized grocery store. The first matching offer in response order wins, retaining its price, product details and platform. This is not a race between providers: the current API returns one combined JSON response without provider timing.

Quantity starts at one and quantity changes stay local. The existing explicit Add to Cart and checkout buttons own all mutations. No offer means a retry state on quantity review; it does not substitute a different brand/size or fall back to a product picker. Closing, going Back, or beginning another request discards a pending banner search result. Ordinary catalogue/voice navigation keeps its existing product selection flow.

For Windows integration on top of the installed home, copy the updated `catalog.js`, `useProductShortcut.js`, `UniversalGuideHome.jsx`, the new `src/quickbite/groceryShortcut.js`, and `public/universal-guide/cola.svg`. Apply the supplied `QuickBitePanel` patch to your existing panel; preserve your local panel edits. No new App wiring, API/QR changes, dependency changes, backend settings, or row catalogue changes are needed. In particular, your QuickBite logo/name edits in `rows.js` stay intact. The packaged cola SVG is temporary illustration; place your real photo at `public/universal-guide/images/hero-cola.jpg`.

## Artwork

Place artwork in `public/universal-guide/images/`. Its README lists every card/ logo filename plus the existing three hero filenames. Local images take priority over reference URLs. Empty/broken reference artwork uses the existing icon initial/background fallback until supplied locally.

## Verification

Check production build, existing unit tests, full source card counts/order, styles against the running reference, traversal to the last cards, inert-card Enter behavior, and the Milk/Coca-Cola and Now Playing Back flows. The earlier `browser-regression.cjs` targets the initial small demo rather than this complete reference layout.

Run `node src/universalGuide/direct-grocery-regression.cjs http://127.0.0.1:5183 /path/to/local-moving-video.mp4` with a dev server for the direct promotion scenarios. All backend/auth/order responses and the video source are mocked only in the browser. It covers exact offer matching and response order, QR-first login, cancelling pairing, quantity/cart/checkout, payment lock, unavailable products/retry, late responses and ordinary grocery navigation. These fixtures do not establish live provider inventory or checkout readiness.
