import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

<<<<<<< HEAD
=======
  allowedDevOrigins: ["rental-os.klynx.net"],

  images: {
    unoptimized: true,
  },
>>>>>>> os-iteration
};

export default nextConfig;