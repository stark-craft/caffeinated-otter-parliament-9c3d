# Universal Guide demo home

Isolated frontend addition based on the layout in `stark-craft/fictional-space-spoon`, reviewed at `b3e5c2d30f260d078a8beabdfc7e927071fa7089`. QuickBite baseline: `a57c3a5ac8ddb4af97a3df2c1072ca8003cbb4fc`.

The home has a left rail, a six-second hero carousel, a centered For You / Live / Apps selector, and a first content row with Now Playing alongside recommendations. Live and Apps are simplified visual demo tabs; entertainment/app tiles do not launch services. The existing shopping panel owns all actual shopping.

## Isolation and Windows integration

All new UI, navigation, styles, hook and tests live in this folder. Demo artwork lives in `public/universal-guide/`. Only `src/App.jsx` has existing-file edits: one player import replacement, one hook import, the hook wiring, and one added player prop. No existing source file is replaced wholesale. No dependency or lockfile changes.

For a Windows workspace with local edits, copy the two new folders and apply these small wiring changes to your current `App.jsx`, rather than overwriting your version:

1. Replace the original player import and add the hook import:

```jsx
import VideoPlayer from './universalGuide/UniversalGuidePlayer.jsx'
import { useProductShortcut } from './universalGuide/useProductShortcut.js'
```

2. After the existing `issueRequest` function, add:

```jsx
const selectHomeProduct = useProductShortcut({
  groceryUnlocked, paneOpen, pairingActive: qrTarget === 'grocery',
  onNavigate: issueRequest, onRequestLogin: requestQrLogin,
  onOpen: () => setPaneOpen(true),
})
```

3. Add `onProductSelect={selectHomeProduct}` to the existing `<VideoPlayer>` props. Leave its other props intact.

The supplied patch contains only these three hunks. Review how they fit your local edits; this cloud checkout cannot inspect `C:\commagent`. If you have renamed an existing state or callback, use its local equivalent.

To use the original full-video landing temporarily, append `?home=classic` to the TV URL. To remove the feature entirely, restore the original import and remove the new hook/prop wiring. Existing QR/API/player/shopping files need no changes.

## Hero assets and shortcuts

`catalog.js` defines the exact three slides: How I Met Your Mother, Milk and Lay's chips. The entertainment slide is inert, including remote Enter. Milk/Chips resolve the existing catalogue IDs into the panel's existing local `voice-nav` input. No search/add/cart/checkout request is made by the shortcut. Only pressing the existing Find button starts discovery.

When Grocery is locked, the new hook asks App to use its existing `requestQrLogin('grocery')`. The normal QR panel, QR generation, session polling, retry and merchant gate remain unchanged. Only the local product target is held until Grocery unlocks. Cancelling pairing drops it; a Food-only connection does not bypass Grocery login. The original navigation guard still protects ongoing shopping/order decisions.

Replace `public/universal-guide/milk.svg` and `chips.svg` with your final product photographs, then update their `image` paths in `catalog.js` (e.g. `./universal-guide/milk.jpg`). The SVGs are temporary illustrations, not product photos. The entertainment slide uses the reference repository's How I Met Your Mother backdrop URL, with a local illustrated fallback if unavailable. No remote images are required for the product slides.

## Now Playing and panel geometry

`UniversalGuidePlayer` keeps one original `VideoPlayer` instance mounted in the first-row tile across all tab changes and panel/QR transitions. Its USB lookup, source fallback, autoplay, loop, media keys and error/retry handling remain original. Use the same USB-root `tv-content.mp4`, packaged `/video/tv-content.mp4`, or existing `VITE_TV_VIDEO_SRC` configuration. No video is copied into application assets by this change.

The new home narrows using the original 0.32-second panel-width transition. The supplied commerce overlay is mounted beside the home rather than inside the small video tile. Scoped CSS cancels the original full-viewport player size and second player squeeze only inside Now Playing; it does not change the original player file or panel styles. Home navigation becomes inert while the panel owns focus and restores the previous target on close. A closed overlay cannot intercept home cards. The home adapter handles F for fullscreen of the whole home, including the shopping/QR overlay, so fullscreen cannot hide the panel outside the video tile. Classic mode retains the original fullscreen behavior.

## Validation

- `npm test`: 81 unit tests pass, including two new catalogue-contract tests.
- Existing browser suite: all 40 scenarios pass unmodified with `?home=classic`.
- Existing browser suite on the new home: all 40 original scenarios/assertions pass with only fixture starting focus placed on Open Quick Shop (Enter on the initial entertainment hero intentionally does nothing). No production code or existing test file is changed for this adaptation.
- New `browser-regression.cjs`: seven scenarios cover inert entertainment, remote navigation, persistent moving video on all tabs, Milk/Chips local landing and squeeze, QR-first login, Grocery gating, cancellation and focus restoration. It checks DOM video identity, advancing playback time and actual tile/video dimensions. An explicit Find press is verified as the first commerce request.
- TV and mobile production builds and `git diff --check` pass.

Run the new browser checks from `tv-frontend` with a dev server and a local moving MP4 fixture:

```sh
ffmpeg -f lavfi -i testsrc2=size=640x360:rate=24 -t 8 -c:v libx264 -pix_fmt yuv420p -movflags +faststart /tmp/ug-playback-test.mp4
node src/universalGuide/browser-regression.cjs http://127.0.0.1:5183 /tmp/ug-playback-test.mp4
```

The browser tests mock all auth/commerce responses and substitute the local MP4 only in the browser. Screenshots are saved under `/tmp/universal-guide-demo`. No live provider login, order or payment was performed. Backend, QR generation, API transport, OAuth, STT/Bixby, mobile app, original player, shopping panel and all existing tests are unchanged.
