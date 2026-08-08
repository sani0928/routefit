import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV !== "production",
  register: false,
  skipWaiting: false,
  clientsClaim: false,
  reloadOnOnline: false,
  cleanupOutdatedCaches: true,
  cacheStartUrl: true,
  dynamicStartUrl: true,
  fallbacks: {
    document: "/offline",
  },
  runtimeCaching: [
    {
      urlPattern: ({ url }: { url: URL }) => self.location.origin === url.origin && url.pathname.startsWith("/api/"),
      handler: "NetworkOnly",
      method: "GET",
      options: { plugins: [] },
    },
    {
      urlPattern: ({ url }: { url: URL }) => self.location.origin === url.origin && url.pathname.startsWith("/_next/static/"),
      handler: "CacheFirst",
      options: {
        cacheName: "routefit-next-static",
        expiration: { maxEntries: 96, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: ({ url }: { url: URL }) => self.location.origin === url.origin && /\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "routefit-static-assets",
        expiration: { maxEntries: 48, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: ({ request, url }: { request: Request; url: URL }) => request.mode === "navigate" && self.location.origin === url.origin,
      handler: "NetworkFirst",
      options: {
        cacheName: "routefit-app-shell",
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  async redirects() {
    return process.env.NODE_ENV === "production" ? [{ source: "/:path*", has: [{ type: "host", value: "routefit.co.kr" }], destination: "https://www.routefit.co.kr/:path*", permanent: true }] : [];
  },
};
export default process.env.NODE_ENV === "production" ? withPWA(nextConfig) : nextConfig;
