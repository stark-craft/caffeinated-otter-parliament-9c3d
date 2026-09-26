# CommerceTV frontend

This is the active frontend folder for both the TV and QR phone setup. The
original `qr_login/mobile-frontend` source is preserved as an inactive backup.

Run `npm install` once, then `npm run dev` from this folder. Vite prints the
actual port (normally 5174). The TV page is `/`; the phone page is `/mobile/`.
For a real phone scan during development, open the TV page using the Mac's
network URL printed by Vite, not `localhost`, so the generated QR points to an
address the phone can reach. Both devices must be able to reach that URL.

`npm run build` produces one `dist/` with `index.html` for TV and
`mobile/index.html` for phone setup. The configured backend remains
`http://107.109.219.138:8077`. The production QR target is set by
`VITE_MOBILE_APP_URL` in `.env.production`; that URL must serve this same
build's `/mobile/` page. A WGT packaged on the TV does not itself serve files
to a phone, so the mobile page still needs a network-reachable static host.
