// ESLint 9 flat config — see https://eslint.org/docs/latest/use/configure/configuration-files
//
// Strategy: start permissive, tighten over time. The goal of Step 1.3-1.4 is to
// catch *real bugs* (rules-of-hooks, no-undef, unused vars) without drowning in
// stylistic warnings that Prettier already handles or `any` complaints we'll
// address in Phase 2.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
    // Global ignores — paths Prettier already ignores, plus build artefacts.
    {
        ignores: [
            "build/**",
            "dist/**",
            ".cache/**",
            ".react-router/**",
            "node_modules/**",
            "public/**",
            "prisma/migrations/**",
            "backups/**",
            "coverage/**",
            "_audit*.txt",
            "_audit*.cjs",
            "_ui-ux-skill-tmp/**",
            ".agent/**",
            ".claude/**",
            ".gemini/**",
            "check-db.cjs",
            "scripts/start.bat",
            "scripts/stop.bat",
            "ecosystem.config.cjs",
        ],
    },

    // Baseline recommended rules for JS + TS.
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // React + hooks for .tsx/.jsx files.
    {
        files: ["**/*.{tsx,jsx}"],
        plugins: {
            react,
            "react-hooks": reactHooks,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
            },
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            // Core React correctness — these catch real bugs.
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            // React 19 / new JSX transform — no need to import React.
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off", // we use TypeScript
            // Prefer warnings over errors for non-critical React issues so they
            // don't block CI while we clean up gradually.
            "react/no-unescaped-entities": "warn",
            "react/display-name": "warn",
            // React 19 plugin flags these in many places that aren't bugs —
            // demote to warn for the baseline; Phase 4 refactor of admin/slides
            // and other monster files will eliminate them naturally.
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/component-hook-factories": "warn",
            "react-hooks/static-components": "warn",
        },
    },

    // Node globals for *.server.ts/.tsx and config files.
    {
        files: [
            "**/*.server.{ts,tsx}",
            "app/entry.server.tsx",
            "app/root.tsx",
            "vite.config.ts",
            "react-router.config.ts",
            "prisma/seed*.ts",
            "scripts/**/*.{js,cjs,mjs,ts}",
        ],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },

    // CommonJS scripts — require() is legitimate, not an error.
    {
        files: ["**/*.cjs", "scripts/**/*.js"],
        languageOptions: {
            globals: { ...globals.node },
            sourceType: "commonjs",
        },
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },

    // Project-wide tweaks — these define our pragmatic baseline.
    {
        rules: {
            // We have ~146 `any` usages slated for Phase 2. Don't block CI on them now.
            "@typescript-eslint/no-explicit-any": "warn",
            // Allow unused fn args prefixed with `_` (intentional ignore).
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            // Allow `as Type` casts — used heavily for Prisma raw queries (Phase 2 cleanup).
            "@typescript-eslint/no-non-null-assertion": "warn",
            // `console.log` allowed but warned about — Phase 4.7 removes them.
            "no-console": ["warn", { allow: ["warn", "error", "info"] }],
            // Empty catch blocks should at least be commented.
            "no-empty": ["warn", { allowEmptyCatch: false }],
            // Force `===` everywhere — `==` causes too many subtle bugs.
            eqeqeq: ["error", "always"],
        },
    },

    // Always last — disables stylistic rules that conflict with Prettier.
    prettier,
);
