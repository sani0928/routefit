"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock3, ListOrdered, Route } from "lucide-react";
import { isSharedCurrentLocation, type SharedRouteSnapshot } from "@/features/shared-routes/types";
import type { TrafficCongestion } from "@/features/route-optimization/types/route.types";
import { routeColor } from "@/lib/route-colors";
import { SharedRouteMap } from "./SharedRouteMap";

const formatDistance = (meters: number) => meters >= 1_000 ? `${(meters / 1_000).toFixed(1)}km` : `${meters}m`;
const formatTime = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
};
// Korea has no daylight-saving time. Formatting numerically prevents server ICU and browser
// locale data from producing different "오전" / "AM" text during hydration.
const toKoreanDate = (value: string, includeTime = false) => {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1_000);
  const day = `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
  return includeTime ? `${day} ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}` : day;
};
const trafficLabel = (sections: SharedRouteSnapshot["result"]["segments"][number]["trafficSections"]) => {
  if (sections.length === 0) return "없음";
  const distance = sections.reduce((sum, section) => sum + Math.max(1, section.distanceMeters), 0);
  const congestion = Math.round(sections.reduce((sum, section) => sum + section.congestion * Math.max(1, section.distanceMeters), 0) / distance) as TrafficCongestion;
  return ({ 0: "없음", 1: "원활", 2: "서행", 3: "혼잡" })[congestion];
};
const trafficTone = (sections: SharedRouteSnapshot["result"]["segments"][number]["trafficSections"]) => {
  if (sections.length === 0) return "unknown";
  const distance = sections.reduce((sum, section) => sum + Math.max(1, section.distanceMeters), 0);
  const congestion = Math.round(sections.reduce((sum, section) => sum + section.congestion * Math.max(1, section.distanceMeters), 0) / distance) as TrafficCongestion;
  return ({ 0: "unknown", 1: "smooth", 2: "slow", 3: "congested" })[congestion];
};

type SharedRouteTab = "stops" | "segments";

export function SharedRouteView({ snapshot, expiresAt }: { snapshot: SharedRouteSnapshot; expiresAt: string }) {
  const [activeTab, setActiveTab] = useState<SharedRouteTab>("stops");
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [focusedPlaceIndex, setFocusedPlaceIndex] = useState<number | null>(null);
  const placesById = useMemo(() => new Map(snapshot.result.orderedPlaces.map((place) => [place.id, place])), [snapshot]);
  const totalDuration = snapshot.result.summary.totalDurationMilliseconds + snapshot.result.summary.totalStayDurationMinutes * 60_000;

  return <main className="shared-route-page" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
    <section className="shared-route-hero-copy">
      <h1>한눈에 보는 방문 동선</h1>
      <span><Clock3 aria-hidden="true" /> {toKoreanDate(snapshot.result.summary.calculatedAt, true)} 계산</span>
    </section>

    <section className="shared-route-layout" aria-label="공유된 방문 동선">
      <div className="shared-route-map-card">
        <SharedRouteMap snapshot={snapshot} highlightedSegmentIndex={selectedSegmentIndex} focusedPlaceIndex={focusedPlaceIndex} onSegmentSelect={(index) => { setFocusedPlaceIndex(null); setSelectedSegmentIndex(index); }} />
      </div>

      <div className="shared-route-content">
        <section className="shared-route-summary-card">
          <img className="shared-route-summary-logo" src="/icons/logo.png" alt="RouteFit" />
          <div><small>예상 소요 시간</small><strong>{formatTime(totalDuration)}</strong></div>
          <dl>
            <div><dt>총 이동 거리</dt><dd>{formatDistance(snapshot.result.summary.totalDistanceMeters)}</dd></div>
            <div><dt>예상 통행료</dt><dd>{snapshot.result.summary.totalTollFare.toLocaleString()}원</dd></div>
            <div><dt>방문 장소</dt><dd>{snapshot.result.orderedPlaces.length}곳</dd></div>
          </dl>
        </section>

        <div className="shared-route-result-tabs" role="tablist" aria-label="공유 동선 정보 보기">
          <button type="button" role="tab" id="shared-route-stops-tab" aria-controls="shared-route-stops-panel" aria-selected={activeTab === "stops"} className={activeTab === "stops" ? "is-active" : ""} onClick={() => { setActiveTab("stops"); setSelectedSegmentIndex(null); }}><ListOrdered aria-hidden="true" />방문 순서</button>
          <button type="button" role="tab" id="shared-route-segments-tab" aria-controls="shared-route-segments-panel" aria-selected={activeTab === "segments"} className={activeTab === "segments" ? "is-active" : ""} onClick={() => setActiveTab("segments")}><Route aria-hidden="true" />구간 상세</button>
        </div>

        {activeTab === "stops" && <section id="shared-route-stops-panel" role="tabpanel" aria-labelledby="shared-route-stops-tab" className="shared-route-stops shared-route-tab-panel">
          <div className="shared-route-section-heading"><div><small>방문 순서</small><h2>추천 방문 동선</h2></div></div>
          <ol>
            {snapshot.result.orderedPlaces.map((place, index) => <li key={`${place.id}-${index}`}>
              <button type="button" onClick={() => { setSelectedSegmentIndex(null); setFocusedPlaceIndex(index); }} aria-label={`${isSharedCurrentLocation(place) ? "현재 위치" : place.name} 중심으로 지도 보기`}>
              <span className="shared-route-stop-number" style={{ "--route-color": routeColor(index) } as React.CSSProperties}>{index + 1}</span>
              <div><strong>{isSharedCurrentLocation(place) ? "현재 위치" : place.name}</strong>{!isSharedCurrentLocation(place) && place.address && <small>{place.address}</small>}</div>
              {Boolean(place.stayDurationMinutes) && <em className="shared-route-stop-stay"><span>머무는 시간</span><b>{place.stayDurationMinutes}분</b></em>}
              </button>
            </li>)}
          </ol>
        </section>}

        {activeTab === "segments" && <section id="shared-route-segments-panel" role="tabpanel" aria-labelledby="shared-route-segments-tab" className="shared-route-segments shared-route-tab-panel">
          <div className="shared-route-section-heading"><div><small>구간 정보</small><h2>구간 별 상세</h2></div></div>
          <ol>
            {snapshot.result.segments.map((segment, index) => {
              const selected = selectedSegmentIndex === index;
              const from = placesById.get(segment.fromId);
              const to = placesById.get(segment.toId);
              return <li key={`${segment.fromId}-${segment.toId}-${index}`} className={selected ? "is-selected" : ""} style={{ "--route-color": routeColor(index) } as React.CSSProperties}>
                <button type="button" aria-pressed={selected} onClick={() => { setFocusedPlaceIndex(null); setSelectedSegmentIndex(index); }}>
                  <span className="shared-route-segment-label">{String.fromCharCode(65 + index)}</span>
                  <span className="shared-route-segment-places"><strong>{from && isSharedCurrentLocation(from) ? "현재 위치" : from?.name ?? "출발 장소"}<i>→</i>{to && isSharedCurrentLocation(to) ? "현재 위치" : to?.name ?? "도착 장소"}</strong></span>
                  <span className="shared-route-segment-metrics"><strong>{formatDistance(segment.distanceMeters)}</strong><small><span className="shared-route-segment-duration"><Clock3 aria-hidden="true" /><b>{formatTime(segment.durationMilliseconds)}</b></span><em className={`traffic-status ${trafficTone(segment.trafficSections)}`}>{trafficLabel(segment.trafficSections)}</em></small></span>
                </button>
              </li>;
            })}
          </ol>
        </section>}
      </div>
    </section>

    <section className="shared-route-final-cta">
      <div className="shared-route-final-cta-copy"><p>나만의 방문 장소를 추가해 보세요.</p><strong>RouteFit에서 내 동선 만들기</strong></div>
      <Link href="/" className="shared-route-final-cta-button">내 동선 계산하기</Link>
    </section>
    <p className="shared-route-expiry">이 공유 링크는 {toKoreanDate(expiresAt)}까지 제공됩니다.</p>
  </main>;
}
