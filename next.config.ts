import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // photos are external links (Google Drive etc.); allow any https host
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
