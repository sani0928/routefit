import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

export const metadata: Metadata = { title: "RouteFit", description: "NAVER Maps 기반 차량 방문 동선 최적화" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}<ToastProvider /></body></html>; }
