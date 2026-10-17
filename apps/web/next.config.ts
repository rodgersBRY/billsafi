import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Local runs share the repository-root .env with the API.
const rootEnvFile = new URL("../../.env", import.meta.url);
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // The Docker image runs the self-contained server; local and CI runs keep `next start`.
  ...(process.env.NEXT_STANDALONE === "1" && {
    output: "standalone",
    outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  }),
  cacheComponents: true,
  partialPrefetching: true,
  // The browser talks to the API through the web origin, so auth cookies stay first-party.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
