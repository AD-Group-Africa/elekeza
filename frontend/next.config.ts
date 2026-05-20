import type { NextConfig } from "next";

// IMPORTANT: NEXT_PUBLIC_API_URL must be set in Vercel environment variables.
// Local dev: set in .env.local as NEXT_PUBLIC_API_URL=http://localhost:8080
// Production: set in Vercel dashboard as NEXT_PUBLIC_API_URL=https://<render-domain>.onrender.com

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;