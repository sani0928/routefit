import { ImageResponse } from "next/og";
import { getSharedRoute } from "@/lib/shared-routes/repository";

export const runtime = "nodejs";
export const alt = "RouteFit 공유 동선";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ shareId: string }> };

function formatTime(milliseconds: number) {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

function formatDistance(meters: number) {
  return meters >= 1_000 ? `${(meters / 1_000).toFixed(1)}km` : `${meters}m`;
}

export default async function OpenGraphImage({ params }: Props) {
  const { shareId } = await params;
  const sharedRoute = await getSharedRoute(shareId);
  const snapshot = sharedRoute?.state === "active" ? sharedRoute.snapshot : null;
  const summary = snapshot?.result.summary;
  const totalDuration = summary
    ? summary.totalDurationMilliseconds + summary.totalStayDurationMinutes * 60_000
    : 0;
  const placeCount = snapshot?.result.orderedPlaces.length ?? 0;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", color: "white", background: "linear-gradient(120deg, #173b7d 0%, #2563eb 44%, #139bdf 73%, #1bb9a8 100%)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "34px", fontWeight: 700 }}><span style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #67e8f9, #5eead4)" }} />RouteFit</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "29px", opacity: .8 }}>공유된 방문 동선</div>
        <div style={{ fontSize: "76px", fontWeight: 700, letterSpacing: "-4px" }}>{summary ? formatTime(totalDuration) : "공유 기간 종료"}</div>
      </div>
      <div style={{ display: "flex", gap: "48px", fontSize: "30px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "21px", opacity: .72 }}>총 이동 거리</span><strong>{summary ? formatDistance(summary.totalDistanceMeters) : "-"}</strong></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "21px", opacity: .72 }}>방문 장소</span><strong>{placeCount ? `${placeCount}곳` : "-"}</strong></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><span style={{ fontSize: "21px", opacity: .72 }}>예상 통행료</span><strong>{summary ? `${summary.totalTollFare.toLocaleString()}원` : "-"}</strong></div>
      </div>
    </div>,
    size,
  );
}
