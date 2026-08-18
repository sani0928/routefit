"use client";

import { useEffect, useRef, useState, type ChangeEvent as ReactChangeEvent, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Clock, ListOrdered, Lock, RotateCcw, Route, LocateFixed, ExternalLink, X } from "lucide-react";
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
const getTrafficReferenceTimeParts = (timestamp: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).formatToParts(new Date(timestamp));
  return {
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
  };
};
const formatDepartureTimeInput = (digits: string) => `${digits.slice(0, 2).padEnd(2, " ")}:${digits.slice(2, 4).padEnd(2, " ")}`;
const normalizeDepartureTimeInput = (value: string) => {
  let digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 2 && Number(digits.slice(0, 2)) > 23) digits = `00${digits.slice(2)}`;
  if (digits.length === 4 && Number(digits.slice(2, 4)) > 59) digits = `${digits.slice(0, 2)}59`;
  return digits;
};
const segmentLabel = (index: number) => String.fromCharCode(65 + index);
const CALCULATION_REASSURANCE_DELAY = 10_000;
const trafficStatus = (congestion: TrafficCongestion) => ({
  0: { label: "없음", className: "unknown" },
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

export function RouteSummary({ result, placeCount, fixedVisitOrders, isCalculating, isLocatingCurrentLocation = false, isRouteStale = false, selectedSegmentIndex, onSegmentHover, onSegmentSelect, onClearResult, onResultTabOpen, onShare, isSharing = false }: { result: OptimizationResponse | null; placeCount: number; fixedVisitOrders: { placeId: string }[]; isCalculating: boolean; isLocatingCurrentLocation?: boolean; isRouteStale?: boolean; selectedSegmentIndex: number | null; onSegmentHover: (index: number | null) => void; onSegmentSelect: (index: number | null) => void; onClearResult?: () => void; onResultTabOpen?: () => void; onShare?: () => void; isSharing?: boolean }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("stops");
  const [expandedSegmentIndex, setExpandedSegmentIndex] = useState<number | null>(null);
  const segmentFocusPointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const segmentSwipeFeedbackTimerRef = useRef<number | null>(null);
  const clearResultConfirmationTimerRef = useRef<number | null>(null);
  const departureInputScrollTimerRef = useRef<number | null>(null);
  const clearResultConfirmationRef = useRef(false);
  const [segmentSwipeFeedback, setSegmentSwipeFeedback] = useState<SegmentSwipeFeedback | null>(null);
  const [isCalculationTakingLong, setIsCalculationTakingLong] = useState(false);
  const [isClearResultPending, setIsClearResultPending] = useState(false);
  const [editedDepartureTime, setEditedDepartureTime] = useState<string | null>(null);

  const fixedPlaceIds = new Set(fixedVisitOrders.map(({ placeId }) => placeId));

  useEffect(() => () => {
    if (segmentSwipeFeedbackTimerRef.current !== null) window.clearTimeout(segmentSwipeFeedbackTimerRef.current);
    if (clearResultConfirmationTimerRef.current !== null) window.clearTimeout(clearResultConfirmationTimerRef.current);
    if (departureInputScrollTimerRef.current !== null) window.clearTimeout(departureInputScrollTimerRef.current);
  }, []);

  useEffect(() => {
    clearResultConfirmationRef.current = false;
    setIsClearResultPending(false);
    setEditedDepartureTime(null);
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
    const title = isLocatingCurrentLocation ? "현재 위치를 확인하고 있어요" : "최적 경로를 계산하고 있어요";
    const message = isLocatingCurrentLocation
      ? "출발지를 최신 위치로 갱신하는 중이에요."
      : isCalculationTakingLong ? "최적의 동선을 열심히 찾고 있어요!" : "실시간 교통정보를 반영하는 중이에요.";
    return (
      <section className="route-summary-panel route-summary-empty route-summary-ready route-summary-calculating">
        {renderReadyStatusHeader(isLocatingCurrentLocation ? "현재 위치 확인 중" : "계산 중", "calculating")}
        <div className="route-ready-card route-ready-calculating-card">
          <div className="route-ready-icon">{isLocatingCurrentLocation ? <LocateFixed aria-hidden="true" /> : <Route aria-hidden="true" />}</div>
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        <div className="route-ready-status">
          <span>{isLocatingCurrentLocation ? "위치 확인 중" : isCalculationTakingLong ? "계산 진행 중" : "분석 중"}</span>
          <strong>{isLocatingCurrentLocation ? "현재 위치를 확인한 뒤 계산을 시작할게요." : isCalculationTakingLong ? "잠시 후 결과를 보여드릴게요." : "잠시만 기다려 주세요."}</strong>
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
            <p>{placeCount}곳의 순서와 이동 시간을 확인할 수 있어요.</p>
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
  const calculatedDepartureTime = getTrafficReferenceTimeParts(result.summary.calculatedAt);
  const hasEditedDepartureTime = editedDepartureTime !== null && editedDepartureTime.length === 4;
  const departureTime = hasEditedDepartureTime
    ? { hour: editedDepartureTime.slice(0, 2), minute: editedDepartureTime.slice(2, 4) }
    : calculatedDepartureTime;
  const adjustedDepartureTime = new Date(new Date(result.summary.calculatedAt).getTime() + ((Number(departureTime.hour) * 60 + Number(departureTime.minute)) - (Number(calculatedDepartureTime.hour) * 60 + Number(calculatedDepartureTime.minute))) * 60_000);
  const estimatedArrivalTime = new Date(adjustedDepartureTime.getTime() + totalDurationMilliseconds);
  let scheduleCursor = adjustedDepartureTime.getTime();
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
  const updateDepartureTime = (value: string) => setEditedDepartureTime(normalizeDepartureTimeInput(value));
  const normalizeDepartureTime = () => setEditedDepartureTime((current) => current?.length === 4 ? current : null);
  const moveDepartureTimeCaretToEnd = (input: HTMLInputElement) => window.requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
  const handleDepartureTimeChange = (event: ReactChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    updateDepartureTime(input.value);
    moveDepartureTimeCaretToEnd(input);
  };
  const handleDepartureTimeKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }
    if (event.key !== "Backspace") return;
    event.preventDefault();
    const input = event.currentTarget;
    const initialValue = `${calculatedDepartureTime.hour}${calculatedDepartureTime.minute}`;
    const clearsSelectedValue = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    setEditedDepartureTime((current) => clearsSelectedValue ? "" : (current ?? initialValue).slice(0, -1));
    moveDepartureTimeCaretToEnd(input);
  };
  const scrollDepartureInputIntoView = (input: HTMLInputElement) => {
    if (departureInputScrollTimerRef.current !== null) window.clearTimeout(departureInputScrollTimerRef.current);
    departureInputScrollTimerRef.current = window.setTimeout(() => {
      if (document.activeElement !== input) return;
      input.scrollIntoView({ block: "nearest", inline: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, 260);
  };
  const handleDepartureTimePointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    event.stopPropagation();
    event.preventDefault();
    const input = event.currentTarget;
    window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
  };
  const handleDepartureTimeFocus = (event: ReactFocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    input.select();
    if (selectedSegmentIndex !== null || expandedSegmentIndex !== null) {
      setExpandedSegmentIndex(null);
      onSegmentSelect(null);
    }
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    onResultTabOpen?.();
    scrollDepartureInputIntoView(input);
  };
  const renderSegmentPreview = (index: number, position: "previous" | "next") => {
    const segment = result.segments[index];
    const from = placesById.get(segment.fromId);
    const to = placesById.get(segment.toId);
    return <div className={`segment-focus-preview segment-focus-preview-${position}`} style={{ "--route-color": routeColor(index) } as CSSProperties} aria-hidden="true">
      <span>{segmentLabel(index)} 구간</span>
      <strong>{from?.name ?? "출발 장소"}</strong>
      <i>→</i>
      <strong>{to?.name ?? "도착 장소"}</strong>
    </div>;
  };
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
      {activeTab === "segments" && focusedSegment && focusedTraffic && activeSegmentIndex !== null && <section key={`${activeSegmentIndex}-${segmentSwipeFeedback?.sequence ?? 0}`} className={`segment-focus-carousel${segmentSwipeFeedback ? ` segment-swipe-${segmentSwipeFeedback.direction}` : ""}${activeSegmentIndex === 0 ? " segment-at-start" : ""}${activeSegmentIndex === result.segments.length - 1 ? " segment-at-end" : ""}`} aria-live="polite" aria-label="선택한 구간 정보. 좌우로 밀어 이전 또는 다음 구간을 확인하세요." onPointerDown={handleSegmentFocusPointerDown} onPointerUp={handleSegmentFocusPointerUp} onPointerCancel={() => { segmentFocusPointerStartRef.current = null; }}>
        {activeSegmentIndex > 0 && renderSegmentPreview(activeSegmentIndex - 1, "previous")}
        <article className="segment-focus-card" style={{ "--route-color": routeColor(activeSegmentIndex) } as CSSProperties}>
          <div className="segment-focus-heading"><span>{segmentLabel(activeSegmentIndex)} 구간</span><button type="button" aria-label="구간 강조 해제" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onClick={() => onSegmentSelect(null)}><X aria-hidden="true" /></button></div>
          <div className="segment-focus-places"><div><strong>{focusedFrom?.name ?? "출발 장소"}</strong><small>출발 {formatTrafficReferenceTime(new Date(segmentSchedules[activeSegmentIndex].departureTime).toISOString())}</small></div><div className="segment-focus-connector"><i aria-hidden="true">→</i><span><Clock aria-hidden="true" /><b>{formatTime(focusedSegment.durationMilliseconds)}</b></span></div><div><strong>{focusedTo?.name ?? "도착 장소"}</strong><small>도착 {formatTrafficReferenceTime(new Date(segmentSchedules[activeSegmentIndex].arrivalTime).toISOString())}</small></div></div>
          <div className="segment-focus-meta"><span>{formatDistance(focusedSegment.distanceMeters)}</span><em className={`traffic-status ${focusedTraffic.className}`}>{focusedTraffic.label}</em></div>
        </article>
        {activeSegmentIndex < result.segments.length - 1 && renderSegmentPreview(activeSegmentIndex + 1, "next")}
      </section>}
<div className="route-hero"><img className="route-hero-logo" src="/icons/logo.png" alt="RouteFit" /><div className="route-hero-heading"><p>예상 소요 시간</p></div><div className="route-hero-overview"><div className={`route-hero-duration${totalDurationMilliseconds >= 60 * 60_000 ? " duration-long" : ""}`}><strong>{formatTime(totalDurationMilliseconds)}</strong>{totalStayDurationMinutes > 0 && <span className="stay-time-summary">머무는 시간 {formatTime(totalStayDurationMinutes * 60_000)} 포함</span>}</div><div className="route-hero-details"><span><small>총 이동 거리</small>{formatDistance(result.summary.totalDistanceMeters)}</span><span><small>예상 통행료</small>{result.summary.totalTollFare.toLocaleString()}원</span></div></div><div className="route-hero-times"><span><small>출발</small><div className="route-hero-time-control"><div className={`route-hero-time-editor${hasEditedDepartureTime ? " is-edited" : ""}`}><input aria-label="출발 시각, 시와 분을 네 자리로 입력" inputMode="numeric" enterKeyHint="done" maxLength={9} value={formatDepartureTimeInput(editedDepartureTime ?? `${calculatedDepartureTime.hour}${calculatedDepartureTime.minute}`)} onPointerDown={handleDepartureTimePointerDown} onChange={handleDepartureTimeChange} onBlur={normalizeDepartureTime} onFocus={handleDepartureTimeFocus} onKeyDown={handleDepartureTimeKeyDown} /></div>{hasEditedDepartureTime && <button type="button" className="route-hero-time-reset" aria-label="수정한 출발 시간 초기화" title="계산 시각으로 되돌리기" onClick={() => setEditedDepartureTime(null)}><RotateCcw aria-hidden="true" /></button>}</div></span><i aria-hidden="true">→</i><span><small>도착 예정</small><time>{formatTrafficReferenceTime(estimatedArrivalTime.toISOString())}</time></span></div></div>

    {onShare && <button type="button" className="route-share-action" disabled={isRouteStale || isSharing} onClick={onShare} title={isRouteStale ? "최신 계산 결과에서만 공유할 수 있습니다." : undefined}>
      <ExternalLink aria-hidden="true" />{isSharing ? "공유 링크 생성 중" : "내 동선 공유하기"}
    </button>}

    <div className="route-result-tabs" role="tablist" aria-label="계산 결과 보기">
      <button type="button" role="tab" id="route-stops-tab" aria-controls="route-stops-panel" aria-selected={activeTab === "stops"} className={activeTab === "stops" ? "is-active" : ""} onClick={() => { setActiveTab("stops"); onSegmentSelect(null); onResultTabOpen?.(); }}><ListOrdered aria-hidden="true" />방문 순서</button>
      <button type="button" role="tab" id="route-segments-tab" aria-controls="route-segments-panel" aria-selected={activeTab === "segments"} className={activeTab === "segments" ? "is-active" : ""} onClick={() => { setActiveTab("segments"); onResultTabOpen?.(); }}><Route aria-hidden="true" />구간 상세</button>
    </div>

    {activeTab === "stops" && <section id="route-stops-panel" role="tabpanel" aria-labelledby="route-stops-tab" className="route-stops-card route-tab-panel"><div className="stops-heading"><div><small>방문 순서</small><strong>{result.orderedPlaces.length}개 지점</strong></div><span>ROUTE</span></div><ol className="modern-route-order">{result.orderedPlaces.map((place, index) => <li key={`${place.id}-${index}`} style={{ "--route-color": routeColor(index) } as CSSProperties}><div className="route-stop-row"><span className="stop-number">{String(index + 1).padStart(2, "0")}</span><span className="route-stop-copy"><span className="route-stop-name"><strong>{place.name}</strong>{fixedPlaceIds.has(place.id) && <Lock className="route-stop-lock" size={13} strokeWidth={2.6} aria-label="방문 순서 고정" />}</span><small>{place.address || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`}</small></span></div></li>)}</ol></section>}

    {activeTab === "segments" && <section id="route-segments-panel" role="tabpanel" aria-labelledby="route-segments-tab" className="segment-details route-tab-panel">
       <div className="segment-panel-heading"><div><small>구간별 상세</small><strong>실시간 교통정보 기준</strong></div><span className="segment-panel-hint">각 구간 클릭 시 상세 정보 표시</span></div>
      <ol>{result.segments.map((segment, index) => {
        const isExpanded = activeSegmentIndex === index;
        const traffic = segmentTrafficStatus(segment.trafficSections ?? []);
        return <li key={`${segment.fromId}-${segment.toId}-${index}`} className={isExpanded ? "segment-expanded" : ""} style={{ "--route-color": routeColor(index) } as CSSProperties}><button type="button" className="segment-row" aria-label={`${segmentLabel(index)} 구간 ${isExpanded ? "접기" : "출발지와 도착지 보기"}`} aria-expanded={isExpanded} onMouseEnter={() => onSegmentHover(index)} onMouseLeave={() => onSegmentHover(null)} onFocus={() => onSegmentHover(index)} onBlur={() => onSegmentHover(null)} onClick={() => { const nextIndex = isExpanded ? null : index; setExpandedSegmentIndex(nextIndex); onSegmentSelect(nextIndex); }}><span className="segment-number">{segmentLabel(index)}</span><p><strong>{formatDistance(segment.distanceMeters)}</strong><small className="segment-duration"><Clock aria-hidden="true" /><b>{formatTime(segment.durationMilliseconds)}</b></small><em className={`traffic-status ${traffic.className}`}>{traffic.label}</em></p></button></li>;
      })}</ol>
    </section>}
  </section>;
}
