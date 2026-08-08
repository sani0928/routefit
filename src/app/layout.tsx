import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OnlineStatusBanner } from "@/components/pwa/OnlineStatusBanner";
import { PwaLifecycle } from "@/components/pwa/PwaLifecycle";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "RouteFit",
  description: "실시간 교통정보를 반영해 차량 방문 동선을 최적화하는 RouteFit",
  applicationName: "RouteFit",
  manifest: "/site.webmanifest?v=5",
  icons: {
    icon: [
      { url: "/icons/icon_192.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon_512.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon_512.png?v=4", sizes: "512x512", type: "image/png" }],
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
