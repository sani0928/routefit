import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "RouteFit", description: "NAVER Maps 기반 차량 방문 동선 최적화" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
