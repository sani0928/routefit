import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { AppLaunchScreen } from "@/components/pwa/AppLaunchScreen";
import { OnlineStatusBanner } from "@/components/pwa/OnlineStatusBanner";
import { PwaLifecycle } from "@/components/pwa/PwaLifecycle";
import { ToastProvider } from "@/components/ui/ToastProvider";

const notoSansKr = Noto_Sans_KR({
  weight: "variable",
  display: "swap",
  variable: "--font-noto-sans-kr",
});

const siteUrl = new URL("https://www.routefit.co.kr");
const siteTitle = "루트핏 (RouteFit)";
const siteDescription = "루트핏(RouteFit) : 실시간 교통정보를 반영해 여러 방문 장소의 이동 경로를 쉽고 빠르게 최적화하는 서비스";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: siteTitle, template: "%s | 루트핏 RouteFit" },
  description: siteDescription,
  applicationName: "루트핏 RouteFit",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "루트핏 RouteFit",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/images/og_image.png", width: 1300, height: 630, alt: "루트핏 RouteFit 방문 경로 최적화" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/og_image.png"],
  },
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
  return <html lang="ko"><body className={notoSansKr.variable}><AppLaunchScreen />{children}<OnlineStatusBanner /><PwaLifecycle /><ToastProvider /></body></html>;
}
