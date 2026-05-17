import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    // tsconfig-paths plugin honours the `~/*` -> `./app/*` alias from tsconfig.json
    plugins: [tsconfigPaths()],
    test: {
        // happy-dom is lighter than jsdom and covers our DOM API needs.
        environment: "happy-dom",
        // Auto-include test files anywhere under tests/ + co-located *.test.ts(x).
        include: ["tests/**/*.{test,spec}.{ts,tsx}", "app/**/*.{test,spec}.{ts,tsx}"],
        // Don't bother coverage-instrumenting code we'd never write tests for.
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["app/**/*.{ts,tsx}"],
            exclude: [
                "app/**/*.test.{ts,tsx}",
                "app/**/*.spec.{ts,tsx}",
                "app/**/*.d.ts",
                "app/entry.client.tsx",
                "app/entry.server.tsx",
                "app/root.tsx",
                "app/routes/**", // routes covered by E2E in Phase 3.6+, not unit
            ],
        },
        // Server-side env vars validated by env.server.ts — set defaults so the
        // module loads during tests without complaint.
        env: {
            NODE_ENV: "test",
            DATABASE_URL: "postgresql://test:test@localhost:5432/test",
            SESSION_SECRET: "test-secret-must-be-at-least-32-characters",
            SITE_URL: "https://mindbody.com.ua",
            ADMIN_PASSWORD: "test-pwd-1234",
            NOVA_POSHTA_API_KEY: "test-key",
        },
    },
});
