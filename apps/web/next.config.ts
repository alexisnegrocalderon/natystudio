import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El paquete compartido se publica como TypeScript sin compilar; Next debe
  // transpilarlo junto con la aplicación.
  transpilePackages: ["@naty/shared", "@naty/api"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "files.manuscdn.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
