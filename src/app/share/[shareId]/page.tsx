import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedRouteView } from "@/components/shared-routes/SharedRouteView";
import { getSharedRoute } from "@/lib/shared-routes/repository";

type Props = { params: Promise<{ shareId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const sharedRoute = await getSharedRoute(shareId);
  const snapshot = sharedRoute?.state === "active" ? sharedRoute.snapshot : null;
  const title = snapshot ? `${snapshot.result.orderedPlaces.length}곳 동선` : "공유 기간이 종료된 동선";
  const description = snapshot
    ? `RouteFit이 계산한 ${snapshot.result.orderedPlaces.length}곳의 방문 동선을 확인해 보세요.`
    : "이 RouteFit 공유 동선은 제공 기간이 종료되었습니다.";
  return {
    title: { absolute: `${title} by RouteFit` },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [`/share/${shareId}/opengraph-image`] },
  };
}

export default async function SharedRoutePage({ params }: Props) {
  const { shareId } = await params;
  const sharedRoute = await getSharedRoute(shareId);
  if (!sharedRoute) notFound();
  if (sharedRoute.state === "expired" || !sharedRoute.snapshot) {
    return <main className="shared-route-expired-page"><img src="/icons/logo.png" alt="RouteFit" /><section><p>공유 기간 종료</p><h1>이 동선의 공유 기간이 종료되었습니다.</h1><span>RouteFit에서 새로운 방문 동선을 만들어 보세요.</span><Link href="/">RouteFit 시작하기</Link></section></main>;
  }
  return <SharedRouteView snapshot={sharedRoute.snapshot} expiresAt={sharedRoute.expiresAt.toISOString()} />;
}
