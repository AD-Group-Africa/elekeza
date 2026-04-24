import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // 1. Prioritize the environment variable, fallback to your Railway production URL, 
    //    and then finally localhost for development.
    const rawUrl = process.env.BACKEND_URL || "https://elekeza-production-38db.up.railway.app/" || "http://localhost:8080";
    
    // 2. Normalize the URL by removing a trailing slash if it exists.
    //    This prevents the destination from becoming "...app//api/..."
    const backendUrl = rawUrl.replace(/\/$/, "");
    
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
