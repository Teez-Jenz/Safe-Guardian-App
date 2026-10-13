import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  productionBrowserSourceMaps: false,
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
