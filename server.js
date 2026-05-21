/**
 * Custom production server — replaces the default `react-router-serve`
 * CLI so we can drop one tiny middleware in front: silent 404s for
 * known-noise requests.
 *
 * Why this exists:
 *   The default server logs every "No routes matched" stack trace to
 *   stderr. Two patterns drown the real errors in noise:
 *     1. Security scanners hammering /.env, /.env.backup, /wp-admin, etc.
 *     2. Browsers that cached a pre-deploy index.html and request the
 *        previous build's hashed JS/CSS chunks (which no longer exist).
 *   Neither is actionable. Both should 404 without writing to error.log.
 *
 * Everything else mirrors @react-router/serve's CLI: compression, morgan
 * access logs, the same three static layers (immutable assets, public
 * path passthrough, /public/* short-cache), and createRequestHandler
 * from @react-router/express.
 *
 * IMPORTANT — NODE_ENV ordering:
 *   ESM hoists static imports above any executable code, so React /
 *   React Router would observe NODE_ENV=undefined at load time and
 *   ship dev builds with broken internals (dispatcher.getOwner is not
 *   a function, etc.). We fix this with **dynamic imports** below —
 *   the assignment runs first, then we import everything else.
 *   PM2's ecosystem.config.cjs also sets NODE_ENV=production in the
 *   env block; this guard is belt-and-suspenders for anyone who runs
 *   `node ./server.js` directly.
 */

// MUST come before any other imports — see header comment.
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

const path = await import("node:path");
const url = await import("node:url");
const { default: compression } = await import("compression");
const { default: express } = await import("express");
const { default: morgan } = await import("morgan");
const { default: sourceMapSupport } = await import("source-map-support");
const { createRequestHandler } = await import("@react-router/express");

sourceMapSupport.install();

const port = Number(process.env.PORT) || 3000;
const buildPath = path.default.resolve("./build/server/index.js");
const buildModule = await import(url.default.pathToFileURL(buildPath).href);
const build = buildModule;

const app = express();

// ────────────────────────────────────────────────────────────────────
// Quiet-404 filter — runs before EVERY other middleware so noise
// requests don't waste compression or routing work either.
// ────────────────────────────────────────────────────────────────────

/**
 * Pathname patterns we silently 404. Add new entries here when log
 * noise spikes from a new bot family or a new stale-chunk pattern.
 */
const QUIET_404_PATTERNS = [
    // Secret-file scanners
    /^\/\.env(\.|$)/i,
    /^\/\.git(\/|$)/i,
    /^\/\.aws(\/|$)/i,
    /^\/\.ssh(\/|$)/i,
    /^\/\.htpasswd$/i,
    /^\/\.htaccess$/i,
    // WordPress / phpMyAdmin probes
    /^\/wp-(admin|content|includes|login)/i,
    /^\/xmlrpc\.php$/i,
    /^\/phpmyadmin/i,
    /^\/pma\//i,
    /^\/administrator\//i,
    // Stale hashed assets from previous deploys. The asset name pattern
    // is `<name>-<8+ alnum hash>.<ext>`; when the hash changes after a
    // deploy, old clients still request the previous one for a while.
    // The static middleware further down handles current assets; this
    // pattern only fires when the file genuinely no longer exists, so
    // we 404 silently instead of letting React Router log the miss.
    /^\/assets\/.*-[A-Za-z0-9_-]{6,}\.(js|css|map)$/,
];

function isQuietNoise(pathname) {
    return QUIET_404_PATTERNS.some((re) => re.test(pathname));
}

// ────────────────────────────────────────────────────────────────────
// Everything below mirrors @react-router/serve's default setup.
// The quiet-404 filter lives AFTER the static layers so existing
// asset files (current build hashes) get served normally — it only
// catches genuine misses (bot probes + stale chunks from prior deploys).
// ────────────────────────────────────────────────────────────────────

app.disable("x-powered-by");
app.use(compression());

// Three static layers — same ordering and options as @react-router/serve.
// build.publicPath defaults to "/", build.assetsBuildDirectory points at
// `build/client` after a production build.
app.use(
    path.default.posix.join(build.publicPath, "assets"),
    express.static(path.default.join(build.assetsBuildDirectory, "assets"), {
        immutable: true,
        maxAge: "1y",
    }),
);
app.use(build.publicPath, express.static(build.assetsBuildDirectory));
app.use(express.static("public", { maxAge: "1h" }));

// Quiet-404 filter — runs AFTER static so we only catch real misses:
// bot probes (/.env, /wp-admin, etc.) and stale chunk requests from
// pre-deploy browser caches. Current build hashes are served by the
// static middleware above and never reach this filter.
app.use((req, res, next) => {
    if (isQuietNoise(req.path)) {
        // 24h browser cache + edge cache so Cloudflare absorbs repeats
        // and the scanner gets the same response without bothering us.
        res.set("Cache-Control", "public, max-age=86400");
        res.status(404).end();
        return;
    }
    next();
});

// Morgan must come AFTER quiet-404 so its `skip` doesn't try to log
// noise requests we already silenced.
app.use(
    morgan("tiny", {
        skip: (req) => isQuietNoise(req.path),
    }),
);

app.all(
    "*",
    createRequestHandler({
        build,
        mode: process.env.NODE_ENV,
    }),
);

const server = app.listen(port, () => {
    console.log(`[mindbody] http://localhost:${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => server.close((err) => err && console.error(err)));
}
