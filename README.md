# Knit Row Tracker

A personal knitting app that installs to your phone's home screen.

- **Patterns:** a built-in 8-row repeat, plus any PDF patterns you add. Claude reads each PDF and turns it into row-by-row steps with technique explanations.
- **Projects:** start a project from a pattern (name, start date, yarn, gauge, notes) and track the row you're on, with big buttons for "row finished" and back.
- **Offline:** after the first visit the app works without a connection. Only reading a new pattern needs the internet.
- **Sync:** patterns, PDFs and progress sync between your devices through your own Cloudflare account (D1 + KV), protected by a sync password. Each device also keeps a full copy, so it works offline.

It's a static site with no build step. Any static host works.

## Hosting

### Cloudflare Pages
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick `knit-row-tracker`. Framework preset: **None**. Build command: leave empty. Build output directory: `/`.
3. **Save and Deploy**. The app is served at `https://<project>.pages.dev` and redeploys on every push.

### GitHub Pages
Repo **Settings** → **Pages** → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.

### Sync setup (Cloudflare)
1. **Storage & Databases → D1 SQL Database → Create**: name it `knit-db`.
2. **Storage & Databases → Workers KV → Create**: name it `knit-files`.
3. Pages project → **Settings → Bindings → Add**:
   - D1 database: variable name `DB` → `knit-db`
   - KV namespace: variable name `FILES` → `knit-files`
4. Pages project → **Settings → Variables and Secrets → Add**: type **Secret**, name `SYNC_PASSWORD`, value of your choice.
5. **Deployments** → latest deployment → **⋯ → Retry deployment** so the settings take effect.
6. On each device: app → Settings → enter the sync password → **Turn on sync**. Start with the device that has the most data.

The sync API lives in `functions/api/[[path]].js`. The database table is created automatically.

## Install on a phone
- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.
- **Android (Chrome):** open the site → menu → **Install app** (or **Add to Home screen**).

## Pattern reading
Settings → paste an Anthropic API key from https://console.anthropic.com/settings/keys. The key is stored only on the device, and the app sends it only to Anthropic's API. Keep the app open while a pattern is being read; it usually takes a minute or two.

## Files
- `index.html`: markup and styles
- `app.js`: app logic (IndexedDB storage, tracker, PDF viewer, Claude pattern reading, backup)
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and home-screen install
- `vendor/`: pdf.js 3.11.174 (legacy build) and a browser bundle of `@anthropic-ai/sdk` 0.133.0
