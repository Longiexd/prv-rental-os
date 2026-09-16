import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["rental-os.klynx.net"],

 output: "export",

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
