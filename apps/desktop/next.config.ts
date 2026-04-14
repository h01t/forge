import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  // Disable server-side features for Tauri
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
