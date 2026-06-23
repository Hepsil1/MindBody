# Live Instagram → homepage iPhone mock

The homepage "iPhone" shows the @mindbody_sportwear profile. A background job
refreshes it hourly from the real Instagram (post count, followers, following,
recent thumbnails). It reads Instagram's public web endpoint with a **session
cookie from a throwaway test account** + a **residential/mobile proxy**, downloads
the images server-side, and writes a local cache the page reads. If anything
fails, the page keeps showing the last-good cache (or the curated fallback) — it
never breaks.

## Why a proxy is required

This VPS's bare IP is already rate-limited (HTTP 429) by Instagram on
`/api/v1/*`. A residential/mobile proxy is mandatory for a real fetch to succeed.
Until one is configured, the page shows the curated fallback (no breakage).

## One-time setup

Set these in the server `.env` (all server-only; never shipped to the browser):

```ini
IG_SCRAPE_ENABLED=true
IG_SCRAPE_TARGET=mindbody_sportwear
IG_SCRAPE_SESSIONID=<sessionid from the TEST account>
IG_SCRAPE_PROXY=http://user:pass@host:port    # residential/mobile
IG_REFRESH_TOKEN=<a random secret of your choice>
```

Then `npm i undici` (only needed for the proxy), rebuild/`pm2 delete mindbody &&
pm2 start ecosystem.config.cjs` (a plain `pm2 restart` often does NOT reload
`.env`).

## Get IG_SCRAPE_SESSIONID — use a TEST / burner account, NEVER the main one

The cookie grants full account access, so use a throwaway account. It lives only
in server `.env` — never in a browser, never in the page, never in git.

1. On a **laptop/PC** (easiest — this one step is fiddly phone-only), open a
   browser and **log in to instagram.com with the test account**.
2. Open DevTools (**F12**) → **Application** tab → **Storage → Cookies →
   https://www.instagram.com**.
3. Find the **`sessionid`** row, copy its **Value** (a long `NNNN%3A…%3A…` string).
4. Paste it into `.env` as `IG_SCRAPE_SESSIONID=` (no quotes).
5. **Do NOT log out** of that browser afterwards (logging out kills the cookie) —
   just close the tab.

The cookie lasts weeks-to-months. When the server logs `response looks
logged-out`, repeat from step 1.

## Verify / trigger manually

```bash
curl -s -X POST https://mindbody-sportwear.com/api/instagram/refresh \
  -H "x-ig-refresh-token: <IG_REFRESH_TOKEN>"
# → {"ok":true,"postsCount":2168,"fetchedAt":"..."}  on success
# → {"ok":false,"skipped":"http-429"}                proxy isn't residential enough
# → {"ok":false,"skipped":"logged-out","sessionLikelyExpired":true}  refresh the cookie
```

On success, `public/instagram/` holds `<shortcode>.webp` (+ `-400w.{webp,avif}`),
`avatar.webp`, and `ig-cache.json`. Reload the homepage → live numbers + real
thumbnails in the iPhone.
