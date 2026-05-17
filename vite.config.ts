import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    // NOTE: previous `define: { 'process.env': {} }` was removed because it
    // emptied process.env in the SSR bundle, breaking env reads on the server
    // (Resend, Telegram, etc.). If any client-side code still does `process.env.X`,
    // migrate it to `import.meta.env.VITE_X` instead — that's the vite-native way.
    plugins: [reactRouter(), tsconfigPaths()],

    // Performance: enable CSS minification
    css: {
        devSourcemap: true,
    },

    build: {
        // Aggressive CSS minification
        cssMinify: "esbuild",
    },

    server: {
        port: 5175,
        strictPort: false,
        allowedHosts: true,
    },
});
