import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : "standalone",
  basePath: isGitHubPages ? "/drop-scout" : undefined,
  assetPrefix: isGitHubPages ? "/drop-scout/" : undefined,
  images: {
    unoptimized: true
  },
  trailingSlash: isGitHubPages,
  turbopack: {
    root: appRoot
  }
};

export default nextConfig;
