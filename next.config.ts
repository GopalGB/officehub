import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Linting runs separately in CI (.github/workflows/ci.yml). The eslint.config.mjs
  // ships in the repo but eslint/plugins are not in package.json yet — install with:
  //   npm i -D eslint @eslint/js typescript-eslint @next/eslint-plugin-next eslint-plugin-security
  // Until then, Next would error during build trying to lint.
  eslint: { ignoreDuringBuilds: true },
  // "standalone" is for `next build` (Docker). Skip in dev — it triggers the
  // vendor-chunks/@swc.js bug in 15.1.6 dev runtime.
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" as const } : {}),
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
