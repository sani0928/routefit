"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ListOrdered, Lock, RotateCcw, Route, X } from "lucide-react";
import type { OptimizationResponse, TrafficCongestion } from "@/features/route-optimization/types/route.types";
import { notify } from "@/lib/notify";
import { routeColor } from "@/lib/route-colors";

const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
const formatTime = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
};
const formatCalculationTime = (milliseconds: number) => milliseconds < 1_000 ? "1초 미만" : `${(milliseconds / 1_000).toFixed(1)}초`;
const formatTrafficReferenceTime = (timestamp: string) => new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(timestamp));
const segmentLabel = (index: number) => String.fromCharCode(65 + index);
const CALCULATION_REASSURANCE_DELAY = 10_000;
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

type SegmentSwipeFeedback = { direction: "next" | "previous" | "start" | "end"; sequence: number };

export function RouteSummary({ result, placeCount, fixedVisitOrders, isCalculating, isRouteStale = false, selectedSegmentIndex, onSegmentHover, onSegmentSelect, onClearResult, onResultTabOpen }: { result: OptimizationResponse | null; placeCount: number; fixedVisitOrders: { placeId: string }[]; isCalculating: boolean; isRouteStale?: boolean; selectedSegmentIndex: number | null; onSegmentHover: (index: number | null) => void; onSegmentSelect: (index: number | null) => void; onClearResult?: () => void; onResultTabOpen?: () => void }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("stops");
  const [expandedSegmentIndex, setExpandedSegmentIndex] = useState<number | null>(null);
  const segmentFocusPointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const segmentSwipeFeedbackTimerRef = useRef<number | null>(null);
  const clearResultConfirmationTimerRef = useRef<number | null>(null);
  const clearResultConfirmationRef = useRef(false);
  const [segmentSwipeFeedback, setSegmentSwipeFeedback] = useState<SegmentSwipeFeedback | null>(null);
  const [isCalculationTakingLong, setIsCalculationTakingLong] = useState(false);
  const [isClearResultPending, setIsClearResultPending] = useState(false);

  const fixedPlaceIds = new Set(fixedVisitOrders.map(({ placeId }) => placeId));

  useEffect(() => () => {
    if (segmentSwipeFeedbackTimerRef.current !== null) window.clearTimeout(segmentSwipeFeedbackTimerRef.current);
    if (clearResultConfirmationTimerRef.current !== null) window.clearTimeout(clearResultConfirmationTimerRef.current);
  }, []);

  useEffect(() => {
    clearResultConfirmationRef.current = false;
    setIsClearResultPending(false);
    if (clearResultConfirmationTimerRef.current !== null) window.clearTimeout(clearResultConfirmationTimerRef.current);
  }, [result]);

  useEffect(() => {
    setExpandedSegmentIndex(selectedSegmentIndex);
    if (selectedSegmentIndex !== null) setActiveTab("segments");
  }, [selectedSegmentIndex]);

  useEffect(() => {
    if (!isCalculating) {
      setIsCalculationTakingLong(false);
      return;
    }
    const timer = window.setTimeout(() => setIsCalculationTakingLong(true), CALCULATION_REASSURANCE_DELAY);
    return () => window.clearTimeout(timer);
  }, [isCalculating]);
  const renderReadyStatusHeader = (label: string, orbClassName = "") => <div className="result-header result-status-header">
    <span aria-hidden="true" />
    <div className="result-eyebrow"><span className={`status-orb ${orbClassName}`} />{label}</div>
    <a className="route-guide-link" href="/guide">1분 체험 가이드</a>
  </div>;
  if (isCalculating) {
    return (
      <section className="route-summary-panel route-summary-empty route-summary-ready route-summary-calculating">
        {renderReadyStatusHeader("계산 중", "calculating")}
        <div className="route-ready-card route-ready-calculating-card">
          <div className="route-ready-icon"><Route aria-hidden="true" /></div>
          <div>
            <h2>최적 경로를 계산하고 있어요</h2>
            <p>{isCalculationTakingLong ? "최적의 동선을 열심히 찾고 있어요!" : "실시간 교통정보를 반영하는 중이에요."}</p>
          </div>
        </div>
        <div className="route-ready-status">
          <span>{isCalculationTakingLong ? "계산 진행 중" : "분석 중"}</span>
          <strong>{isCalculationTakingLong ? "잠시 후 결과를 보여드릴게요." : "잠시만 기다려 주세요."}</strong>
        </div>
      </section>
    );
  }
  if (!result && placeCount < 2) {
    const remaining = 2 - placeCount;
    return (
      <section className="route-summary-panel route-summary-empty route-summary-ready route-summary-requirements">
        {renderReadyStatusHeader("장소 추가 필요")}
        <div className="route-ready-card route-ready-requirements-card">
          <div className="route-ready-icon"><ListOrdered aria-hidden="true" /></div>
          <div>
            <h2>장소를 더 추가해 주세요</h2>
            <p>경로 계산은 방문 장소 2곳부터 가능해요.</p>
          </div>
        </div>
        <div className="route-ready-status">
          <span>{placeCount} / 2곳</span>
          <strong>장소 {remaining}곳을 더 추가하면 계산할 수 있어요.</strong>
        </div>
      </section>
    );
  }
  if (!result) {
    return (
      <section className="route-summary-panel route-summary-empty route-summary-ready">
        {renderReadyStatusHeader("계산 전")}
        <div className="route-ready-card">
          <div className="route-ready-icon"><Route aria-hidden="true" /></div>
          <div>
            <h2>최적 경로를 계산해 보세요</h2>
            <p>방문 장소 {placeCount}곳의 순서와 이동 시간을 확인할 수 있어요.</p>
          </div>
        </div>
        <div className="route-ready-status">
          <span>준비됨</span>
          <strong>계산 버튼을 누르면 경로 계산을 시작합니다.</strong>
        </div>
      </section>
    );
  }

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
  const showSegmentSwipeFeedback = (direction: SegmentSwipeFeedback["direction"]) => {
    if (segmentSwipeFeedbackTimerRef.current !== null) window.clearTimeout(segmentSwipeFeedbackTimerRef.current);
    setSegmentSwipeFeedback((current) => ({ direction, sequence: (current?.sequence ?? 0) + 1 }));
    segmentSwipeFeedbackTimerRef.current = window.setTimeout(() => setSegmentSwipeFeedback(null), 360);
  };
  const selectAdjacentSegment = (direction: -1 | 1) => {
    if (activeSegmentIndex === null) return;
    const nextIndex = activeSegmentIndex + direction;
    if (nextIndex < 0 || nextIndex >= result.segments.length) {
      showSegmentSwipeFeedback(direction < 0 ? "start" : "end");
      return;
    }
    showSegmentSwipeFeedback(direction < 0 ? "previous" : "next");
    setExpandedSegmentIndex(nextIndex);
    onSegmentSelect(nextIndex);
  };
  const handleSegmentFocusPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    segmentFocusPointerStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleSegmentFocusPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = segmentFocusPointerStartRef.current;
    segmentFocusPointerStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 48 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;
    selectAdjacentSegment(horizontalDistance < 0 ? 1 : -1);
  };
  const handleClearResult = () => {
    if (!onClearResult) return;
    if (clearResultConfirmationRef.current) {
      clearResultConfirmationRef.current = false;
      setIsClearResultPending(false);
      if (clearResultConfirmationTimerRef.current !== null) window.clearTimeout(clearResultConfirmationTimerRef.current);
      onClearResult();
      return;
    }

    clearResultConfirmationRef.current = true;
    setIsClearResultPending(true);
    notify.info("한 번 더 누르면 계산 결과가 초기화됩니다.");
    clearResultConfirmationTimerRef.current = window.setTimeout(() => {
      clearResultConfirmationRef.current = false;
      setIsClearResultPending(false);
    }, 3_000);
  };


  return <section className="route-summary-panel">
    <div className="result-header">
      <div className="result-header-leading">
        {onClearResult && <button type="button" className={`route-summary-clear${isClearResultPending ? " is-pending" : ""}`} aria-label="계산 결과 초기화" onClick={handleClearResult}><RotateCcw aria-hidden="true" /><span>초기화</span></button>}
        <div className="result-eyebrow"><span className={`status-orb ${isRouteStale ? "stale" : "success"}`} />{isRouteStale ? "재계산 필요" : "최적화 완료"}</div>
      </div>
      <span className="result-time">계산 {formatCalculationTime(result.summary.calculationDurationMilliseconds)}</span>
    </div>
    {isRouteStale && <p className="route-recalculation-notice" role="status">방문 장소가 변경되었습니다.</p>}
      {activeTab === "segments" && focusedSegment && focusedTraffic && activeSegmentIndex !== null && <section key={`${activeSegmentIndex}-${segmentSwipeFeedback?.sequence ?? 0}`} className={`segment-focus-card${segmentSwipeFeedback ? ` segment-swipe-${segmentSwipeFeedback.direction}` : ""}${activeSegmentIndex === 0 ? " segment-at-start" : ""}${activeSegmentIndex === result.segments.length - 1 ? " segment-at-end" : ""}`} style={{ "--route-color": routeColor(activeSegmentIndex) } as CSSProperties} aria-live="polite" aria-label="선택한 구간 정보. 좌우로 밀어 이전 또는 다음 구간을 확인하세요." onPointerDown={handleSegmentFocusPointerDown} onPointerUp={handleSegmentFocusPointerUp} onPointerCancel={() => { segmentFocusPointerStartRef.current = null; }}><div className="segment-focus-heading"><span>{segmentLabel(activeSegmentIndex)} 구간</span><button type="button" aria-label="구간 강조 해제" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={() => onSegmentSelect(null)}><X aria-hidden="true" /></button></div><div className="segment-focus-places"><div><strong>{focusedFrom?.name ?? "출발 장소"}</strong><small>출발 {formatTrafficReferenceTime(new Date(segmentSchedules[activeSegmentIndex].departureTime).toISOString())}</small></div><i aria-hidden="true">→</i><div><strong>{focusedTo?.name ?? "도착 장소"}</strong><small>도착 {formatTrafficReferenceTime(new Date(segmentSchedules[activeSegmentIndex].arrivalTime).toISOString())}</small></div></div><div className="segment-focus-meta"><span>{formatDistance(focusedSegment.distanceMeters)}</span><span>{formatTime(focusedSegment.durationMilliseconds)}</span><em className={`traffic-status ${focusedTraffic.className}`}>{focusedTraffic.label}</em></div></section>}
<div className="route-hero"><img className="route-hero-logo" src="/icons/logo.png" alt="RouteFit" /><div className="route-hero-heading"><p>예상 소요 시간</p></div><div className="route-hero-overview"><div className={`route-hero-duration${totalDurationMilliseconds >= 60 * 60_000 ? " duration-long" : ""}`}><strong>{formatTime(totalDurationMilliseconds)}</strong>{totalStayDurationMinutes > 0 && <span className="stay-time-summary">머무는 시간 {formatTime(totalStayDurationMinutes * 60_000)} 포함</span>}</div><div className="route-hero-details"><span><small>총 이동 거리</small>{formatDistance(result.summary.totalDistanceMeters)}</span><span><small>예상 통행료</small>{result.summary.totalTollFare.toLocaleString()}원</span></div></div><div className="route-hero-times"><span><small>출발</small><time>{formatTrafficReferenceTime(result.summary.calculatedAt)}</time></span><i aria-hidden="true">→</i><span><small>도착 예정</small><time>{formatTrafficReferenceTime(estimatedArrivalTime.toISOString())}</time></span></div></div>

    <div className="route-result-tabs" role="tablist" aria-label="계산 결과 보기">
      <button type="button" role="tab" id="route-stops-tab" aria-controls="route-stops-panel" aria-selected={activeTab === "stops"} className={activeTab === "stops" ? "is-active" : ""} onClick={() => { setActiveTab("stops"); onSegmentSelect(null); onResultTabOpen?.(); }}><ListOrdered aria-hidden="true" />방문 순서</button>
      <button type="button" role="tab" id="route-segments-tab" aria-controls="route-segments-panel" aria-selected={activeTab === "segments"} className={activeTab === "segments" ? "is-active" : ""} onClick={() => { setActiveTab("segments"); onResultTabOpen?.(); }}><Route aria-hidden="true" />구간 상세</button>
    </div>

    {activeTab === "stops" && <section id="route-stops-panel" role="tabpanel" aria-labelledby="route-stops-tab" className="route-stops-card route-tab-panel"><div className="stops-heading"><div><small>방문 순서</small><strong>{result.orderedPlaces.length}개 지점</strong></div><span>ROUTE</span></div><ol className="modern-route-order">{result.orderedPlaces.map((place, index) => <li key={`${place.id}-${index}`} style={{ "--route-color": routeColor(index) } as CSSProperties}><div className="route-stop-row"><span className="stop-number">{String(index + 1).padStart(2, "0")}</span><span className="route-stop-copy"><span className="route-stop-name"><strong>{place.name}</strong>{fixedPlaceIds.has(place.id) && <Lock className="route-stop-lock" size={13} strokeWidth={2.6} aria-label="방문 순서 고정" />}</span><small>{place.address || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`}</small></span></div></li>)}</ol></section>}

    {activeTab === "segments" && <section id="route-segments-panel" role="tabpanel" aria-labelledby="route-segments-tab" className="segment-details route-tab-panel">
      <div className="segment-panel-heading"><div><small>구간별 상세</small><strong>실시간 교통정보 기준</strong></div></div>
      <ol>{result.segments.map((segment, index) => {
        const isExpanded = activeSegmentIndex === index;
        const from = placesById.get(segment.fromId);
        const to = placesById.get(segment.toId);
        const traffic = segmentTrafficStatus(segment.trafficSections ?? []);
        return <li key={`${segment.fromId}-${segment.toId}-${index}`} className={isExpanded ? "segment-expanded" : ""} style={{ "--route-color": routeColor(index) } as CSSProperties}><button type="button" className="segment-row" aria-label={`${segmentLabel(index)} 구간 ${isExpanded ? "접기" : "출발지와 도착지 보기"}`} aria-expanded={isExpanded} onMouseEnter={() => onSegmentHover(index)} onMouseLeave={() => onSegmentHover(null)} onFocus={() => onSegmentHover(index)} onBlur={() => onSegmentHover(null)} onClick={() => { const nextIndex = isExpanded ? null : index; setExpandedSegmentIndex(nextIndex); onSegmentSelect(nextIndex); }}><span className="segment-number">{segmentLabel(index)}</span><p>{formatDistance(segment.distanceMeters)}<small>{formatTime(segment.durationMilliseconds)}</small><em className={`traffic-status ${traffic.className}`}>{traffic.label}</em></p></button>{isExpanded && <div className="segment-place-details"><div className="segment-place-time"><strong>{from?.name ?? "출발 장소"}</strong><small>출발 {formatTrafficReferenceTime(new Date(segmentSchedules[index].departureTime).toISOString())}</small></div><div className="segment-place-time"><strong>{to?.name ?? "도착 장소"}</strong><small>도착 {formatTrafficReferenceTime(new Date(segmentSchedules[index].arrivalTime).toISOString())}</small></div></div>}</li>;
      })}</ol>
    </section>}
  </section>;
}
