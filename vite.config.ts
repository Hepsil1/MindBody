import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],

  // Performance: enable CSS minification
  css: {
    devSourcemap: true,
  },

  build: {
    // Aggressive CSS minification
    cssMinify: 'esbuild',
  },

  server: {
    port: 5175,
    strictPort: false,
    allowedHosts: true,
  },
});
