import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    // NOTE: previous `define: { 'process.env': {} }` was removed because it
    // emptied process.env in the SSR bundle, breaking env reads on the server
    // (Resend, Telegram, etc.). If any client-side code still does `process.env.X`,
    // migrate it to `import.meta.env.VITE_X` instead — that's the vite-native way.
    plugins: [reactRouter(), tsconfigPaths()],

    // Keep a single sonner instance so the mounted <Toaster> and toast() calls
    // share one store — otherwise toasts silently never render. Pre-bundle it so
    // Vite doesn't re-optimize it into a second instance mid-session. (Do NOT add
    // react/react-dom here: deduping them broke the slides editor, which pulls in
    // storefront components, with a "null dispatcher" dual-React error.)
    resolve: {
        dedupe: ["sonner", "framer-motion"],
    },
    optimizeDeps: {
        // Pre-bundle framer-motion too: otherwise Vite lazily optimizes it the
        // first time a modal mounts <AnimatePresence> (ConfirmDialog), pulling a
        // SECOND React copy into that chunk -> "useContext of null" dual-React
        // crash in the slides editor. Dev-only; the Rollup build is unaffected.
        include: ["sonner", "framer-motion"],
    },

    // Performance: enable CSS minification
    css: {
        devSourcemap: true,
    },

    build: {
        // Aggressive CSS minification
        cssMinify: "esbuild",
        // Cache-bust segment in every asset filename. Bump ASSET_REV when
        // Cloudflare has edge-cached a stale/poisoned response for an asset
        // URL — changing the filename gives every asset a brand-new URL
        // that CF has never seen, so it cache-misses and re-fetches from
        // origin. Content hashes alone don't rotate when source is
        // unchanged, so this manual revision is the reliable lever.
        rollupOptions: {
            output: {
                entryFileNames: "assets/[name]-[hash]-r3.js",
                chunkFileNames: "assets/[name]-[hash]-r3.js",
                assetFileNames: "assets/[name]-[hash]-r3[extname]",
            },
        },
    },

    server: {
        port: 5175,
        strictPort: false,
        allowedHosts: true,
    },
});
