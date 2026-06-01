import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    // NOTE: previous `define: { 'process.env': {} }` was removed because it
    // emptied process.env in the SSR bundle, breaking env reads on the server
    // (Resend, Telegram, etc.). If any client-side code still does `process.env.X`,
    // migrate it to `import.meta.env.VITE_X` instead — that's the vite-native way.
    plugins: [reactRouter(), tsconfigPaths()],

    // Keep a single instance of these libs. sonner in particular broke when Vite
    // discovered it mid-session and re-optimized: <Toaster> and toast() ended up
    // in two different optimized chunks (two stores), so toasts never rendered.
    // Pre-bundling it at startup + dedupe guarantees one instance.
    resolve: {
        dedupe: ["sonner", "react", "react-dom"],
    },
    optimizeDeps: {
        include: ["sonner"],
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
