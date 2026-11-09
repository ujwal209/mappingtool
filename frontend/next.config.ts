import type { NextConfig } from "next";

const rawBackendUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.BACKEND_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/v1\/?$/, "");

const nextConfig: NextConfig = {
  typescript: {
    // Ignore TypeScript errors during production build
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/glincker/thesvg/**",
      },
    ],
  },
  async rewrites() {
    if (rawBackendUrl) {
      return [
        {
          source: "/api/v1/:path*",
          destination: `${rawBackendUrl}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
