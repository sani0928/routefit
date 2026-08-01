import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return process.env.NODE_ENV === "production" ? [{ source: "/:path*", has: [{ type: "host", value: "routefit.co.kr" }], destination: "https://www.routefit.co.kr/:path*", permanent: true }] : [];
  },
};
export default nextConfig;