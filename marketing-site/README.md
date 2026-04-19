# ParkMate Marketing Site

This folder is a static site bundle ready for drag-and-drop hosting.

## Files

- `index.html`
- `admin-zone-suggestions.html`
- `privacy-policy.html`
- `terms-of-service.html`
- `parkmate-logo.svg`
- `pakenham-map-bg.jpg`
- `testflight-qr.svg`

## Fastest launch path

1. Upload this folder to Netlify Drop or create a new Vercel project with this folder as the site root.
2. Verify the site works on the temporary host URL.
3. In Namecheap DNS, point your domain to the host using the DNS records the host gives you.
4. Enable HTTPS on the host.

## Notes

- The home page uses CDN-delivered Tailwind and Lucide, so no build step is required.
- `admin-zone-suggestions.html` is a static admin tool that signs in with Supabase in-browser and calls the existing ParkMate admin review APIs.
- The page reads its browser-safe config from `admin-zone-suggestions.config.js`.
- Keep admin email access in Supabase Auth plus the backend allowlist. Do not hardcode passwords into the page.
- `support@getparkmate.app` is the default backend admin allowlist email if no admin email env var is set.
- Optional: set `window.PARKMATE_ADMIN_API_BASE` in `admin-zone-suggestions.config.js` if the API is on a different origin.
- If you want a production-grade branded domain, replace any remaining placeholder social links or marketing copy before launch.
