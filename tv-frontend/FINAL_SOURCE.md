# QuickShop — Consolidated frontend source (14 October 2026)

This folder is the complete GitHub-side frontend source for the consolidated branch `release/quickshop-final-20261014`. The application is in `src/`; the `docs/windows-integration/` directory is historical reference material, **not** the active React source.

## What is integrated

- Provider-specific Zepto, Zomato, Swiggy Food, and Instamart request attribution and QR routing; discovery continuation after the required merchant connects.
- Universal Guide hero carousel pausing while the shop panel is open; food and grocery hero discovery routing.
- Speech/voice reply module and local voice on/off commands.
- Swiggy Instamart attribution without falsely labeling a generic `Swiggy` cart as Swiggy Food.
- Live order tracking using `POST /api/track`, exact provider milestone display, and the persistent Back → order status → Exit footer navigation.
- Cart actions presented in a **vertical stack**, never a three-column horizontal row. Quantities and backend-owned action labels are untouched.

## Active source files

- `src/App.jsx`
- `src/components/quickbite/QuickBitePanel.jsx`
- `src/components/quickbite/screens/TextScreen.jsx`
- `src/styles/quickbite.css`
- `src/styles/orderTrackingFooter.css`
- `src/quickbite/tracking.js`
- `src/quickbite/providers.js`
- `src/quickbite/deriveIntent.js`
- `src/quickbite/speech.js`
- `src/quickbite/voiceNavigation.js`
- `src/universalGuide/UniversalGuideHome.jsx`
- `src/universalGuide/catalog.js`
- `src/universalGuide/searchBanners.js`

## Run or verify

```powershell
cd tv-frontend
npm ci
npm test
npm run build
npm run dev
```

The GitHub Actions workflow at `.github/workflows/quickshop-validate.yml` is configured to run tests and the Vite build on branch pushes.

## Source-of-truth limitation

This is a consolidated GitHub branch assembled from the accessible repository and code shared in the discussion. **It has not been proven identical to the latest uncommitted source files on the Windows machine.** In particular, locally updated implementations from the Windows machine may have advanced beyond the GitHub source used to construct the branch. Do not treat it as a byte-for-byte backup of that Windows workspace until its contents are compared.

This branch holds full files, not incremental local update scripts. Older patch scripts have been removed from this branch.
