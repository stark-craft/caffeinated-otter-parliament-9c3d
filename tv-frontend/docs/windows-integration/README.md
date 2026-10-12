# Windows QuickBite panel update

This complete panel uses the five parts you pasted from `C:\commagent\tv-frontend\src\components\quickbite\QuickBitePanel.jsx` as its base. It adds the direct Samsung home-banner flow for **Amul Milk 1 L** and **regular Coca-Cola 1 L**. It is not a replacement with GitHub main's different panel implementation.

## Install in your existing Windows app

1. Back up your current `C:\commagent\tv-frontend\src\components\quickbite\QuickBitePanel.jsx`.
2. Download this folder's **QuickBitePanel.jsx**, using GitHub's **Download raw file**, and replace that Windows file with it. Keep the filename `QuickBitePanel.jsx`; do not import the file from `docs/windows-integration`.
3. If your existing `src/universalGuide/useProductShortcut.js` still sends the old local catalogue navigation, replace it with the accompanying **useProductShortcut.js**. This version needs only React and retains the pending banner through your existing QR login. The hook from main commit `2800fc95c3d80b03cf6c35cac1bd021ab3e3d118` also works when its helper dependencies are already installed.
4. Keep your existing App wiring, API settings, QR components, other panel screens, video and logo changes. The installed Samsung home must pass banner IDs `milk` and `cola` to `onProductSelect`; if you still have the old chips banner, use the previously supplied home catalogue update for Coca-Cola while retaining your own photos.
5. Run your normal frontend build and check the banners in Chrome. After pairing if required, each banner searches and opens quantity review. Select quantity, press **Add to Cart**, and use the provider's checkout actions yourself.

The hook expects the existing App integration: `groceryUnlocked`, `paneOpen`, `pairingActive: qrTarget === 'grocery'`, `onNavigate: issueRequest`, `onRequestLogin: requestQrLogin`, and `onOpen: () => setPaneOpen(true)`. `issueRequest` must add a fresh `nonce`, as your pasted App already does. The hook's return value is supplied as `onProductSelect` to `UniversalGuidePlayer`. This wiring was already present in the preceding home integration; this package does not replace your App.jsx.

**windows-quickbite-panel-updated.zip** contains both files in their destination directory structure, plus the review material. Extract to a temporary folder, back up your originals, then copy the two files as described above.

## What was preserved and added

All 62 original named functions remain; 53 have unchanged executable syntax trees. All original imports remain. The existing cart additions, local draft quantity/removal editing, single draft commit and read-only fallback, cart clearing, checkout action handling, uncertain checkout retry, payment rendering and tracking handlers have unchanged executable syntax trees. The compare-model cache, cart-cancellation UI and existing navigation behavior are retained.

The additions are fixed-product matching, a banner-only search handler, the external `grocery-shortcut` request branch, quantity loading/error/retry rendering, and native focus on this banner review. The handler chooses the first matching in-stock offer in the combined response, with a confirmed price and grocery store. It does not race providers. Wrong brands, pack sizes, multipacks, unavailable offers and Coca-Cola Zero/Diet are rejected. The banner does not add anything or place an order automatically.

Closing, leaving or superseding banner discovery discards late results. Three existing read-only discovery handlers (dish, ordinary product and restaurant-menu searches) gain scoped checks so an older result cannot overwrite a newly opened banner page. Their original prompts and result handling remain. Existing payment guards and merchant-login checks are used; no backend, API or QR-generation code was changed for this package.

## Comparison and source accuracy

`QuickBitePanel.windows-original.jsx` is the assembled capture of your five pasted parts. Chat collapsed some source line breaks, so formatting and comment layout were restored during assembly. It is not a byte-for-byte export from your PC. The complete updated file preserves that capture's executable code except for the scoped additions listed above.

`QuickBitePanel.windows-to-updated.patch` compares that captured baseline with the updated file. Use it to review the additions; because your actual PC formatting can differ, it may not apply directly with `git apply`. Prefer backing up and replacing the complete file.

`preservation-audit.json` lists the retained, changed and added named functions. `edit-reversal-check.json` confirms that reversing the 16 scoped edits recovers the captured baseline exactly. GitHub main at comparison time was `2800fc95c3d80b03cf6c35cac1bd021ab3e3d118`; its newer provider/widget/cart handling was deliberately not substituted into your working PC panel.

## Validation and limits

Five matcher tests, twelve mocked browser scenarios, and a production fixture build passed. Browser scenarios cover exact product selection, QR-first pairing, cancellation, unavailable products and retry, stale searches, ordinary product selection, local draft edits, one mutation followed by a read-only cart fallback, and read-only recovery after an uncertain draft mutation. Logs are included under `validation/`.

The cloud fixture loads this merged panel and hook against the repository's supporting modules. For validation only, it aliases the renamed main export `isCartDestructiveAction` to your existing import `isCartClearAction`. This alias is not included in the delivered runtime files; your working Windows project already needs the original export. The draft-removal controller branch was invoked directly in the test because main's supporting cart renderer differs from your PC renderer.

I cannot access the remaining Windows modules or your deployed backend's raw responses. These results verify the captured panel in the cloud fixture, not a full build of your actual Windows dependency tree or a live commerce order. No build/configuration change is needed for this delivery.

The files are published on the separate `integrate/windows-quickbite-quantity` branch under `tv-frontend/docs/windows-integration/`. Application source files and main remain unchanged by this delivery commit.
