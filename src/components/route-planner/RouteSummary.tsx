"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ListOrdered, Lock, Route, X } from "lucide-react";
import type { OptimizationResponse, TrafficCongestion } from "@/features/route-optimization/types/route.types";
import { ROUTE_OPTION_META, type RouteOption } from "@/features/route-optimization/route-options";
import { routeColor } from "@/lib/route-colors";

const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
const formatTime = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
};
const formatCalculationTime = (milliseconds: number) => milliseconds < 1_000 ? "1초 미만" : `${(milliseconds / 1_000).toFixed(1)}초`;
const formatTrafficReferenceTime = (timestamp: string) => new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(timestamp));
const segmentLabel = (index: number) => String.fromCharCode(65 + index);
const trafficStatus = (congestion: TrafficCongestion) => ({
  0: { label: "정보 없음", className: "unknown" },
  1: { label: "원활", className: "smooth" },
  2: { label: "서행", className: "slow" },
  3: { label: "혼잡", className: "congested" },
})[congestion];
const segmentTrafficStatus = (sections: OptimizationResponse["segments"][number]["trafficSections"]) => {
  if (sections.length === 0) return trafficStatus(0);
  const totalDistance = sections.reduce((total, section) => total + Math.max(section.distanceMeters, 1), 0);
  const weightedCongestion = sections.reduce((total, section) => total + section.congestion * Math.max(section.distanceMeters, 1), 0) / totalDistance;
  return trafficStatus(Math.round(weightedCongestion) as TrafficCongestion);
};

type ResultTab = "stops" | "segments";

export function RouteSummary({ result, routeOption, placeCount, fixedVisitOrders, isCalculating, isCurrentLocationStale = false, selectedSegmentIndex, onSegmentHover, onSegmentSelect }: { result: OptimizationResponse | null; routeOption: RouteOption; placeCount: number; fixedVisitOrders: { placeId: string }[]; isCalculating: boolean; isCurrentLocationStale?: boolean; selectedSegmentIndex: number | null; onSegmentHover: (index: number | null) => void; onSegmentSelect: (index: number | null) => void }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("stops");
  const [expandedSegmentIndex, setExpandedSegmentIndex] = useState<number | null>(null);


  const routeOptionClass = `route-summary-option-${ROUTE_OPTION_META[routeOption].tone}`;
  const fixedPlaceIds = new Set(fixedVisitOrders.map(({ placeId }) => placeId));

  useEffect(() => {
    setExpandedSegmentIndex(selectedSegmentIndex);
    if (selectedSegmentIndex !== null) setActiveTab("segments");
  }, [selectedSegmentIndex]);

  if (isCalculating) {
    return <section className={`route-summary-panel route-summary-empty route-summary-calculating ${routeOptionClass}`}><div className="result-eyebrow"><span className="status-orb calculating" />계산 중</div><h2>최적 경로를 찾고 있어요</h2><p className="result-intro">교통 상황과 구간별 예상 시간을 비교하고 있습니다.</p><div className="empty-route-card calculating-route-card"><div className="empty-route-icon calculating-icon">↗</div><div><strong>이동 시간을 분석하는 중</strong><span>잠시만 기다려 주세요 <span className="loading-dots" aria-label="계산 중"><i /><i /><i /></span></span></div></div><div className="calculation-progress" aria-hidden="true"><span /><span /><span /></div><p className="result-footer-note">방문 장소가 많을수록 계산에 조금 더 시간이 걸릴 수 있습니다.</p></section>;
  }

  if (!result && placeCount < 2) {
    const remaining = 2 - placeCount;
    return <section className={`route-summary-panel route-summary-empty route-summary-requirements ${routeOptionClass}`}><div className="result-eyebrow"><span className="status-orb" />장소 추가 필요</div><h2>{placeCount === 0 ? "방문 장소를 추가해 주세요" : "한 곳만 더 추가해 주세요"}</h2><div className="minimum-place-card"><div className="minimum-place-count"><strong>{placeCount}</strong><span>/ 2</span></div><div><strong>장소 {remaining}곳이 더 필요</strong><span>{placeCount === 0 ? "출발지와 방문지를 추가해 주세요" : "다음 방문지를 추가하면 동선을 계산할 수 있어요"}</span></div></div><p className="result-footer-note">장소를 추가하면 예상 시간과 방문 순서를 확인할 수 있습니다.</p></section>;
  }

  if (!result) return <section className={`route-summary-panel route-summary-empty ${routeOptionClass}`}><div className="result-eyebrow"><span className="status-orb" />계산 대기</div><h2>오늘의 최적 동선</h2><p className="result-intro">장소를 추가하면 실시간 교통정보를 반영한 가장 효율적인 방문 순서를 안내합니다.</p><div className="empty-route-card"><div className="empty-route-icon">↗</div><div><strong>이동 시간을 줄여보세요</strong><span>동선 최적화 버튼을 눌러 시작하세요</span></div></div><div className="empty-feature-list"><div><span>01</span><p><strong>장소 추가</strong><small>검색하거나 지도에서 선택</small></p></div><div><span>02</span><p><strong>동선 최적화</strong><small>실시간 교통 기준 계산</small></p></div><div><span>03</span><p><strong>경로 확인</strong><small>지도와 구간별 결과 제공</small></p></div></div><p className="result-footer-note">경로는 현재 교통상황을 기준으로 계산합니다.</p></section>;

  const placesById = new Map(result.orderedPlaces.map((place) => [place.id, place]));
  const totalStayDurationMinutes = result.summary.totalStayDurationMinutes ?? 0;
  const totalDurationMilliseconds = result.summary.totalDurationMilliseconds + totalStayDurationMinutes * 60_000;
  const estimatedArrivalTime = new Date(new Date(result.summary.calculatedAt).getTime() + totalDurationMilliseconds);
  let scheduleCursor = new Date(result.summary.calculatedAt).getTime();
  const segmentSchedules = result.segments.map((segment, index) => {
    const departureTime = scheduleCursor;
    const arrivalTime = departureTime + segment.durationMilliseconds;
    scheduleCursor = arrivalTime;
    if (index < result.segments.length - 1) scheduleCursor += (placesById.get(segment.toId)?.stayDurationMinutes ?? 0) * 60_000;
    return { departureTime, arrivalTime };
  });

  const activeSegmentIndex = selectedSegmentIndex ?? expandedSegmentIndex;
  const focusedSegment = activeSegmentIndex === null ? null : result.segments[activeSegmentIndex] ?? null;
  const focusedFrom = focusedSegment ? placesById.get(focusedSegment.fromId) : null;
  const focusedTo = focusedSegment ? placesById.get(focusedSegment.toId) : null;
  const focusedTraffic = focusedSegment ? segmentTrafficStatus(focusedSegment.trafficSections ?? []) : null;


  return <section className={`route-summary-panel ${routeOptionClass}`}>
    <div className="result-header"><div className="result-eyebrow"><span className="status-orb success" />최적화 완료</div><span className="result-time">계산 {formatCalculationTime(result.summary.calculationDurationMilliseconds)}</span></div>
    {isCurrentLocationStale && <p className="route-recalculation-notice" role="status">현재 위치가 변경되었습니다. 다시 계산해 주세요.</p>}
      {activeTab === "segments" && focusedSegment && focusedTraffic && activeSegmentIndex !== null && <section className="segment-focus-card" style={{ "--route-color": routeColor(activeSegmentIndex) } as CSSProperties} aria-live="polite"><div className="segment-focus-heading"><span>{segmentLabel(activeSegmentIndex)} 구간 선택됨</span><button type="button" aria-label="구간 강조 해제" onClick={() => onSegmentSelect(null)}><X aria-hidden="true" /></button></div><div className="segment-focus-places"><div><strong>{focusedFrom?.name ?? "출발 장소"}</strong><small>출발 {formatTrafficReferenceTime(new Date(segmentSchedules[activeSegmentIndex].departureTime).toISOString())}</small></div><i aria-hidden="true">→</i><div><strong>{focusedTo?.name ?? "도착 장소"}</strong><small>도착 {formatTrafficReferenceTime(new Date(segmentSchedules[activeSegmentIndex].arrivalTime).toISOString())}</small></div></div><div className="segment-focus-meta"><span>{formatDistance(focusedSegment.distanceMeters)}</span><span>{formatTime(focusedSegment.durationMilliseconds)}</span><em className={`traffic-status ${focusedTraffic.className}`}>{focusedTraffic.label}</em></div></section>}
<div className="route-hero"><div className="route-hero-heading"><p>예상 소요 시간</p><span className="route-option-badge">{ROUTE_OPTION_META[routeOption].label}</span></div><div className="route-hero-overview"><div className="route-hero-duration"><strong>{formatTime(totalDurationMilliseconds)}</strong>{totalStayDurationMinutes > 0 && <span className="stay-time-summary">이동 시간 ({formatTime(result.summary.totalDurationMilliseconds)}) + 머무는 시간 ({formatTime(totalStayDurationMinutes * 60_000)})</span>}</div><div className="route-hero-details"><span><small>총 이동 거리</small>{formatDistance(result.summary.totalDistanceMeters)}</span><span><small>예상 통행료</small>{result.summary.totalTollFare.toLocaleString()}원</span></div></div><div className="route-hero-times"><span><small>출발</small><time>{formatTrafficReferenceTime(result.summary.calculatedAt)}</time></span><i aria-hidden="true">→</i><span><small>도착 예정</small><time>{formatTrafficReferenceTime(estimatedArrivalTime.toISOString())}</time></span></div></div>

    <div className="route-result-tabs" role="tablist" aria-label="계산 결과 보기">
      <button type="button" role="tab" id="route-stops-tab" aria-controls="route-stops-panel" aria-selected={activeTab === "stops"} className={activeTab === "stops" ? "is-active" : ""} onClick={() => { setActiveTab("stops"); onSegmentSelect(null); }}><ListOrdered aria-hidden="true" />방문 순서</button>
      <button type="button" role="tab" id="route-segments-tab" aria-controls="route-segments-panel" aria-selected={activeTab === "segments"} className={activeTab === "segments" ? "is-active" : ""} onClick={() => setActiveTab("segments")}><Route aria-hidden="true" />구간 상세</button>
    </div>

    {activeTab === "stops" && <section id="route-stops-panel" role="tabpanel" aria-labelledby="route-stops-tab" className="route-stops-card route-tab-panel"><div className="stops-heading"><div><small>방문 순서</small><strong>{result.orderedPlaces.length}개 지점</strong></div><span>ROUTE</span></div><ol className="modern-route-order">{result.orderedPlaces.map((place, index) => <li key={`${place.id}-${index}`} style={{ "--route-color": routeColor(index) } as CSSProperties}><div className="route-stop-row"><span className="stop-number">{String(index + 1).padStart(2, "0")}</span><span className="route-stop-copy"><span className="route-stop-name"><strong>{place.name}</strong>{fixedPlaceIds.has(place.id) && <Lock className="route-stop-lock" size={13} strokeWidth={2.6} aria-label="방문 순서 고정" />}</span><small>{place.address || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`}</small></span></div></li>)}</ol></section>}

    {activeTab === "segments" && <section id="route-segments-panel" role="tabpanel" aria-labelledby="route-segments-tab" className="segment-details route-tab-panel">
      <div className="segment-panel-heading"><div><small>구간별 상세</small><strong>실시간 교통정보 기준</strong></div></div>
      <ol>{result.segments.map((segment, index) => {
        const isExpanded = activeSegmentIndex === index;
        const from = placesById.get(segment.fromId);
        const to = placesById.get(segment.toId);
        const traffic = segmentTrafficStatus(segment.trafficSections ?? []);
        return <li key={`${segment.fromId}-${segment.toId}-${index}`} className={isExpanded ? "segment-expanded" : ""} style={{ "--route-color": routeColor(index) } as CSSProperties}><button type="button" className="segment-number" aria-label={`${segmentLabel(index)} 구간 ${isExpanded ? "접기" : "출발지와 도착지 보기"}`} aria-expanded={isExpanded} onMouseEnter={() => onSegmentHover(index)} onMouseLeave={() => onSegmentHover(null)} onFocus={() => onSegmentHover(index)} onBlur={() => onSegmentHover(null)} onClick={() => { const nextIndex = isExpanded ? null : index; setExpandedSegmentIndex(nextIndex); onSegmentSelect(nextIndex); }}>{segmentLabel(index)}</button><p>{formatDistance(segment.distanceMeters)}<small>{formatTime(segment.durationMilliseconds)}</small><em className={`traffic-status ${traffic.className}`}>{traffic.label}</em></p>{isExpanded && <div className="segment-place-details"><div className="segment-place-time"><strong>{from?.name ?? "출발 장소"}</strong><small>출발 {formatTrafficReferenceTime(new Date(segmentSchedules[index].departureTime).toISOString())}</small></div><i aria-hidden="true">to</i><div className="segment-place-time"><strong>{to?.name ?? "도착 장소"}</strong><small>도착 {formatTrafficReferenceTime(new Date(segmentSchedules[index].arrivalTime).toISOString())}</small></div></div>}</li>;
      })}</ol>
    </section>}
  </section>;
}