import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Local runs share the repository-root .env with the API.
const rootEnvFile = new URL("../../.env", import.meta.url);
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

// The release version lives in the root package.json and is bumped with each release PR.
const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

const apiInternalUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
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
        // Re-emitting as plain *.css would turn CSS Modules into global stylesheets.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
