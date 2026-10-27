import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Include an optional root logo in standalone/Docker builds when it exists.
  outputFileTracingIncludes: { "/brand/logo": ["./logo.png"] },
  // The dedicated CI lint command checks the complete repository.
  eslint: { ignoreDuringBuilds: true },
  // "standalone" is for `next build` (Docker). Skip in dev — it triggers the
  // vendor-chunks/@swc.js bug in 15.1.6 dev runtime.
  ...(process.env.NODE_ENV === "production" ? { output: "standalone" as const } : {}),
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
