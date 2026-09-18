import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  allowedDevOrigins: ["rental-os.klynx.net"],

  images: {
    unoptimized: true,
  },
};

export default nextConfig;