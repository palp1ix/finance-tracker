# Контур

Frontend: https://palp1ix.github.io/finance-tracker/kontur/

Static frontend on GitHub Pages, encrypted sync via a separate Cloudflare Worker and D1 database.

Run locally: npm run dev. Test: npm test. Build: npm run build. No runtime dependencies.

Live API: https://kontur-sync.palp1ix-kontur.workers.dev/api/vault (requires the private connection token).

Backend: authenticate with Wrangler, create a separate kontur-vault database, put its database_id in cloudflare/wrangler.jsonc, apply migrations and deploy. SYNC_TOKEN_HASH must be set as a Worker secret. Never commit the connection token or connection JSON files.

Connect phone and PC using the same private JSON connection file and master password. Import the connection in Settings on an unlocked device, or use the cloud button on the lock screen to download an existing encrypted vault. The master password stays on device.

Before moving from localhost or another site, export an encrypted backup and restore it here. Browser storage is scoped to the origin. The legacy root app is preserved.
