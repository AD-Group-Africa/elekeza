import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // We are forcing it to use the Railway URL directly
    const backendUrl = "https://elekeza-production-38db.up.railway.app";
    
    console.log("Rewriting API calls to:", backendUrl);

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
