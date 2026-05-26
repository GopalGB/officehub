// ESLint 9 flat config — minimal, strict, AI-agent-friendly.
// Strict TS rules + security rules. No formatting rules (Prettier handles that).
//
// Plugins live in devDependencies; install with:
//   npm i -D eslint @eslint/js typescript-eslint eslint-plugin-security eslint-config-next

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import securityPlugin from "eslint-plugin-security";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      security: securityPlugin,
    },
    rules: {
      // Next.js
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // Security
      "security/detect-object-injection": "off",  // too noisy for typical bracket access
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-pseudoRandomBytes": "error",

      // TypeScript strict overrides
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",

      // Workflow
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "no-debugger": "error",
    },
  },
  {
    // Relaxations for config files
    files: ["*.config.*", "next.config.ts", "tailwind.config.ts", "postcss.config.mjs"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "no-console": "off",
    },
  },
  {
    // Scripts can use console + non-literal paths
    files: ["scripts/**", "prisma/seed.ts"],
    rules: {
      "no-console": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
);
