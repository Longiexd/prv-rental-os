import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!apiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is required. Set it explicitly for development, staging, or production.",
  );
}

const nextConfig: NextConfig = {
  output: "standalone",

  allowedDevOrigins: [
    "rental-os.klynx.net",
    "staging.rental-os.klynx.net",
  ],

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
