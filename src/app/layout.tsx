import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OnlineStatusBanner } from "@/components/pwa/OnlineStatusBanner";
import { PwaLifecycle } from "@/components/pwa/PwaLifecycle";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "RouteFit",
  description: "실시간 교통정보를 반영해 차량 방문 동선을 최적화하는 RouteFit",
  applicationName: "RouteFit",
  manifest: "/site.webmanifest?v=1",
  icons: {
    icon: [
      { url: "/icons/favicon.ico?v=1", sizes: "any" },
      { url: "/icons/favicon.svg?v=1", type: "image/svg+xml" },
      { url: "/icons/favicon-96x96.png?v=1", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon_192.png?v=1", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon_512.png?v=1", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=1", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RouteFit" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f8fc",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}<OnlineStatusBanner /><PwaLifecycle /><ToastProvider /></body></html>;
}
