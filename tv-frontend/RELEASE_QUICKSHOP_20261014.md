# QuickShop consolidated source — October 14, 2026

This branch contains the complete **GitHub-tracked** QuickShop project files. The runtime app entry is `tv-frontend/src/App.jsx`; the shopping sidebar is `tv-frontend/src/components/quickbite/QuickBitePanel.jsx`.

## Included in this branch

- Provider-specific login checks and QR pairing recovery for Zomato, Swiggy Food, Swiggy Instamart and Zepto.
- Provider attribution that does not mislabel an ambiguous bare Swiggy cart as Swiggy Food when explicit Instamart evidence is present.
- Universal Guide hero carousel that pauses while the shopping pane is open.
- Voice intent rules for spoken checkout and clearing a cart.
- Live `POST /api/track` milestone display, with the Back → Order status → Exit remote-navigation footer.
- Checkout choices stacked **vertically**; quantity auto-add and the backend-defined actions are unchanged.
- Self-contained voice feedback and banner search modules, with regression tests.

## Use the full files — no patch scripts

Select this branch in GitHub's **Code** menu to browse the complete source or download the branch. No patch installer is needed. The old historical `docs/windows-*` references are **not** the runtime source of truth.

In `tv-frontend` run:

```powershell
npm ci
npm test
npm run build
```

## Source synchronization note

This is a complete GitHub branch snapshot, **not a verified byte-for-byte mirror of the working directory at `C:\commagent\tv - frontend`**. Some October 14 changes existed only in local Windows files and chat. The speech and banner modules were reconstituted for this branch from the known interfaces and behaviors. Compare/commit any newer local-only edits before replacing your Windows working files wholesale.

The tests and build should be run in a checkout of this branch; they have not been executed against this branch in the user's Windows environment.
