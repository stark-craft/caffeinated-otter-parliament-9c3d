# TV layout, remote navigation and login continuation

This update gives the Samsung home and full video view one shared squeeze frame and one stationary commerce host. It fixes the narrow panel on first Enter, makes Play/Pause return from video to TV home, and retains the latest banner or spoken request while the user connects merchants.

## Install on your existing Windows app

Keep your working `QuickBitePanel.jsx`, API settings, STT hooks, QR components, video and QuickBite logo assets. The panel receives only two small hook edits described below; its remaining code and formatting are preserved.

1. Download **windows-tv-layout-login-update.zip** from this folder using GitHub's Download raw file button, then extract it to a temporary folder.
2. Open PowerShell in the extracted folder. Check that your older Windows App matches the supplied edits:

   ```powershell
   node .\apply-windows-update.cjs "C:\commagent\tv-frontend"
   ```

   This checks only; it writes nothing. The installer matches the App structure you previously pasted, with the Samsung home wiring already installed. It tolerates formatting differences but requires every edit anchor to match exactly once.
3. If the check succeeds, install:

   ```powershell
   node .\apply-windows-update.cjs "C:\commagent\tv-frontend" --apply
   ```

   It automatically backs up every existing file it will change under `C:\commagent\tv-frontend\backups\tv-ui-login-<timestamp>\`, then applies focused App edits, the panel hook edit and the four Universal Guide files. It does not reformat the rest of your App or panel.
4. Run your normal build, restart the frontend and check in Chrome/TV:

   ```powershell
   cd C:\commagent\tv-frontend
   npm run build
   npm run dev
   ```

If the check reports a mismatching anchor, it leaves all files untouched. Review **App.windows-login-continuation.patch** against your current PC App; this is a focused comparison, not a whole-App replacement. The patch baseline uses the earlier Windows App structure plus the installed Samsung home wiring. Later PC edits were not available in this cloud workspace.

## Exact destination files

| Package content | Destination on your PC |
| --- | --- |
| Focused edits from `app-edits.json` | `C:\commagent\tv-frontend\src\App.jsx` |
| Two hook edits from `QuickBitePanel.before-paint.patch` | `C:\commagent\tv-frontend\src\components\quickbite\QuickBitePanel.jsx` |
| `tv-frontend/src/universalGuide/UniversalGuidePlayer.jsx` | `C:\commagent\tv-frontend\src\universalGuide\UniversalGuidePlayer.jsx` |
| `tv-frontend/src/universalGuide/universalGuide.css` | `C:\commagent\tv-frontend\src\universalGuide\universalGuide.css` |
| `tv-frontend/src/universalGuide/useProductShortcut.js` | `C:\commagent\tv-frontend\src\universalGuide\useProductShortcut.js` |
| `tv-frontend/src/universalGuide/useLoginContinuation.js` | `C:\commagent\tv-frontend\src\universalGuide\useLoginContinuation.js` |

You can copy the four Universal Guide files manually and integrate the App and panel patches if preferred. The panel edits add `useLayoutEffect` to the React import if needed and change only the effect beginning `if (!externalRequest?.nonce) return` from `useEffect` to `useLayoutEffect`. This handles a resumed request before painting the default home screen. Its cart, checkout and payment handlers are unchanged. The Windows hook in this package builds its `milk`/`cola` request locally and does not need the newer main branch's provider helpers. Your existing Samsung home must already pass these banner IDs through `onProductSelect`.

## Resulting controls and login behavior

- Home and full video use identical content-frame scaling and commerce-panel placement at a given viewport. The video stays mounted in the Now Playing tile when entering/leaving its full view.
- Enter/OK opens commerce from full video. Back navigates or closes commerce; further Back/Backspace/Escape presses stay in the video. A closed video view no longer returns home through Back.
- Play/Pause returns from full video to TV home, closing the commerce overlay if open. Play or Pause keys do the same for remotes that report them separately. Space provides the same action in Chrome. Navigation preserves the video's existing playback state. In the classic `?home=classic` player, existing media controls remain.
- Milk and Coca-Cola banners wait for Grocery login, then search and open quantity selection without showing Start Shopping. They do not add to cart or checkout automatically.
- A spoken request retains its transcript, language, trace and view context through pairing. It resumes once with the refreshed merchant/session state. Known local voice navigation stays local. A request to buy packaged milk/juice/cola uses Grocery access; explicit restaurant/provider requests keep their routing.
- Only the latest pending activity is retained. A new voice request replaces a pending banner or earlier utterance. Cancelling/closing pairing drops the pending activity. Plain Enter, which supplies no shopping context, still opens the ordinary shopping landing after login.
- In the older Windows App, QR and commerce components remain mounted and only their visibility/active keyboard ref switches. The request effect runs before paint, avoiding the default-home frame after pairing.

## Diagnosis and validation

The narrow-panel issue was reproduced using the delivered Windows panel: `scrollIntoView` had scrolled the panel's clipping host horizontally by **430px**, leaving a narrow strip visible. `overflow:clip` makes that host stationary; a horizontal scroll-reset fallback covers engines without that CSS value. The shared outer frame prevents a second, different squeeze inside the video player. The full-video card also disables its catalogue focus animation so it cannot transiently become the fixed video's containing block.

Validation covers the repository app and a fixture using the older Windows App structure with its focused patch and the previously delivered Windows panel. Browser API, pairing, video and STT callback results are mocked; no live order was placed. The fixture uses main's other supporting modules, including a test-only alias for the renamed `isCartClearAction` export. The alias is not in this package. Actual remaining PC files and Samsung hardware were unavailable.

The source update is on `fix/tv-layout-login-continuation`; this delivery does not merge into main. Logs in `validation/` record the build, unit tests, grocery regression and login/layout scenarios. The installer is checked against a reference App, its backup is verified, and a deliberately incompatible App is checked to fail without writing files.
