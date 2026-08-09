"use client";

import { useRef, useState, type DragEvent, type PointerEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  GripVertical,
  Hand,
  Info,
  MapPin,
  Minus,
  Plus,
  Route,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";

type GuideStage = "places" | "calculating" | "result";
type GuidePlace = { id: string; name: string; stayMinutes: number; position: { x: number; y: number } };
type SwipeMode = "stay" | null;

const mapPositions = [{ x: 38, y: 25 }, { x: 69, y: 69 }, { x: 82, y: 25 }, { x: 24, y: 43 }];
const initialPlace: GuidePlace = { id: "current-location", name: "현재 위치", stayMinutes: 0, position: { x: 16, y: 73 } };
const suggestedPlaces = [
  { id: "city-hall", name: "시청", position: mapPositions[0] },
  { id: "central-library", name: "중앙도서관", position: mapPositions[1] },
  { id: "neighborhood-park", name: "근린공원", position: mapPositions[2] },
];
const optimizedVisitSequences: Record<string, string[]> = {
  "central-library|city-hall": ["city-hall", "central-library"],
  "city-hall|neighborhood-park": ["city-hall", "neighborhood-park"],
  "central-library|neighborhood-park": ["neighborhood-park", "central-library"],
  "central-library|city-hall|neighborhood-park": ["city-hall", "neighborhood-park", "central-library"],
};
const routeEstimates: Record<string, { distanceKm: number; travelMinutes: number }> = {
  "central-library|city-hall": { distanceKm: 14.2, travelMinutes: 31 },
  "city-hall|neighborhood-park": { distanceKm: 16.8, travelMinutes: 36 },
  "central-library|neighborhood-park": { distanceKm: 19.5, travelMinutes: 42 },
  "central-library|city-hall|neighborhood-park": { distanceKm: 24.3, travelMinutes: 49 },
};

export function InteractiveGuide() {
  const [places, setPlaces] = useState<GuidePlace[]>([initialPlace]);
  const [stage, setStage] = useState<GuideStage>("places");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [openSwipe, setOpenSwipe] = useState<{ id: string; mode: SwipeMode } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const gesturePointerRef = useRef<{ x: number; pointerId: number } | null>(null);
  const placeSwipeRef = useRef<{ id: string; x: number; y: number; pointerId: number } | null>(null);
  const touchDragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const visitPlaces = places.slice(1);
  const canCalculate = visitPlaces.length >= 2;
  const visitSetKey = visitPlaces.map((place) => place.id).sort().join("|");
  const optimizedIds = optimizedVisitSequences[visitSetKey];
  const routeEstimate = routeEstimates[visitSetKey] ?? { distanceKm: 0, travelMinutes: 0 };
  const estimatedDuration = routeEstimate.travelMinutes + visitPlaces.reduce((sum, place) => sum + place.stayMinutes, 0);
  const optimizedVisits = optimizedIds
    ? optimizedIds.map((id) => visitPlaces.find((place) => place.id === id)).filter((place): place is GuidePlace => Boolean(place))
    : visitPlaces;
  const resultPlaces = stage === "result" ? [places[0], ...optimizedVisits] : places;
  const routePath = resultPlaces.map((place, index) => `${index === 0 ? "M" : "L"}${place.position.x} ${place.position.y}`).join(" ");

  function addSuggestedPlace(place: (typeof suggestedPlaces)[number]) {
    if (places.some((current) => current.id === place.id)) return;
    setPlaces((current) => [...current, { ...place, stayMinutes: 0 }]);
  }

  function removePlace(id: string) {
    setPlaces((current) => current.filter((place) => place.id !== id));
    setOpenSwipe(null);
  }

  function updatePlace(id: string, updater: (place: GuidePlace) => GuidePlace) {
    setPlaces((current) => current.map((place) => place.id === id ? updater(place) : place));
  }

  function movePlace(sourceId: string, targetId: string) {
    if (sourceId === initialPlace.id || targetId === initialPlace.id || sourceId === targetId) return;
    setPlaces((current) => {
      const sourceIndex = current.findIndex((place) => place.id === sourceId);
      const targetIndex = current.findIndex((place) => place.id === targetId);
      if (sourceIndex < 1 || targetIndex < 1 || sourceIndex === targetIndex) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function calculateRoute() {
    if (!canCalculate || stage !== "places") return;
    setStage("calculating");
    window.setTimeout(() => setStage("result"), 1100);
  }

  function handleNativeDragStart(event: DragEvent<HTMLLIElement>, id: string) {
    if (id === initialPlace.id) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  }

  function handleNativeDrop(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    movePlace(event.dataTransfer.getData("text/plain"), targetId);
    setDraggingId(null);
  }

  function startTouchDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.pointerType === "mouse" || id === initialPlace.id) return;
    touchDragRef.current = { id, pointerId: event.pointerId };
    setDraggingId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTouchDrag(event: PointerEvent<HTMLButtonElement>) {
    const activeDrag = touchDragRef.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-guide-place-id]");
    const targetId = target?.dataset.guidePlaceId;
    if (targetId) movePlace(activeDrag.id, targetId);
  }

  function endTouchDrag() {
    touchDragRef.current = null;
    setDraggingId(null);
  }

  function startPlaceSwipe(event: PointerEvent<HTMLDivElement>, id: string) {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button, .guide-place-grip")) return;
    placeSwipeRef.current = { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePlaceSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = placeSwipeRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 28 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;
    if (horizontalDistance > 0) setOpenSwipe({ id: start.id, mode: "stay" });
  }

  function endPlaceSwipe(event: PointerEvent<HTMLDivElement>) {
    const start = placeSwipeRef.current;
    placeSwipeRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 44 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return setOpenSwipe(null);
    setOpenSwipe(horizontalDistance > 0 ? { id: start.id, mode: "stay" } : null);
  }

  function handleGestureStart(event: PointerEvent<HTMLDivElement>) {
    gesturePointerRef.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGestureMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesturePointerRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setSwipeOffset(Math.max(-112, Math.min(0, event.clientX - start.x)));
  }

  function handleGestureEnd(event: PointerEvent<HTMLDivElement>) {
    const start = gesturePointerRef.current;
    gesturePointerRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    setSwipeOffset(event.clientX - start.x < -44 ? -112 : 0);
  }

  return (
    <main className="guide-page">
      <header className="guide-nav">
        <a className="guide-brand" href="/" aria-label="루트핏 RouteFit 홈으로 이동"><img src="/icons/logo.png" alt="루트핏 RouteFit" /></a>
        <a className="guide-nav-start" href="/">바로 시작하기</a>
      </header>

      <section className="guide-hero" aria-labelledby="guide-title">
        <span className="guide-kicker">1분 체험 가이드</span>
        <h1 id="guide-title">오늘 갈 곳을 추가하고,<br />가장 편한 순서를 찾아보세요.</h1>
        <p>루트핏(RouteFit)은 여러 방문 장소를 한곳에 모아, 실시간 교통정보를 반영한 이동 경로를 보여줍니다. 아래 화면을 직접 눌러 실제 사용 흐름을 미리 경험해 보세요.</p>
        <div className="guide-flow" aria-label="RouteFit 사용 순서">
          <span className={stage === "places" ? "active" : "complete"}><b>1</b>장소 추가</span><ChevronRight aria-hidden="true" />
          <span className={stage === "calculating" ? "active" : stage === "result" ? "complete" : ""}><b>2</b>경로 계산</span><ChevronRight aria-hidden="true" />
          <span className={stage === "result" ? "active" : ""}><b>3</b>결과 확인</span>
        </div>
      </section>

      <section className="guide-workspace" aria-label="RouteFit 사용 체험">
        <div className="guide-map-preview" aria-hidden="true">
          <div className="guide-map-grid" /><span className="guide-map-road road-one" /><span className="guide-map-road road-two" />
          {stage === "result" && <svg className="guide-route-line" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={routePath} fill="none" pathLength="1" /></svg>}
          {places.map((place) => {
            const routeOrder = resultPlaces.findIndex((candidate) => candidate.id === place.id) + 1;
            return <span className="guide-map-pin" style={{ left: `${place.position.x}%`, top: `${place.position.y}%` }} key={place.id}><b>{stage === "result" ? routeOrder : places.findIndex((candidate) => candidate.id === place.id) + 1}</b><i>{place.name}</i></span>;
          })}
        </div>

        <div className="guide-panel">
          <div className="guide-panel-chrome" aria-label={`현재 단계: ${stage === "places" ? "장소 추가" : stage === "calculating" ? "경로 계산" : "결과 확인"}`}>
            <span className={stage === "places" ? "active" : "complete"} />
            <span className={stage === "calculating" ? "active" : stage === "result" ? "complete" : ""} />
            <span className={stage === "result" ? "active" : ""} />
          </div>
          {stage !== "result" ? <>
            <div className="guide-panel-heading"><div><h2>방문 장소 추가</h2></div><span>{visitPlaces.length}곳 추가됨</span></div>
            <p className="guide-panel-copy">검색창은 실제 서비스에서 장소를 찾는 위치입니다.<br className="guide-panel-copy-break" />방문 순서와 계산 흐름을 체험해 보세요.</p>
            <div className="guide-search" role="img" aria-label="장소, 주소 검색창 예시">
              <span className="guide-search-placeholder">장소, 주소 검색</span><span className="guide-search-submit" aria-hidden="true"><Search /></span>
            </div>
            <div className="guide-suggestions" aria-label="예시 장소 추가"><span>예시로 추가</span>{suggestedPlaces.filter((place) => !places.some((current) => current.id === place.id)).map((place) => <button type="button" key={place.id} onClick={() => addSuggestedPlace(place)}><MapPin aria-hidden="true" />{place.name}</button>)}</div>
            <p className="guide-list-help"><GripVertical aria-hidden="true" /> 손잡이를 드래그해 방문 순서를 바꿔보세요.</p>
            <ol className="guide-place-list">
              {places.map((place, index) => {
                const swipeMode = openSwipe?.id === place.id ? openSwipe.mode : null;
                return <li key={place.id} data-guide-place-id={place.id} draggable={index > 0} onDragStart={(event) => handleNativeDragStart(event, place.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleNativeDrop(event, place.id)} onDragEnd={() => setDraggingId(null)} className={`guide-place-item${index === 0 ? " is-start" : ""}${draggingId === place.id ? " is-dragging" : ""}${swipeMode ? ` swipe-${swipeMode}` : ""}`}>
                  {index > 0 && <div className="guide-place-stay-tray"><button type="button" onClick={() => updatePlace(place.id, (current) => ({ ...current, stayMinutes: Math.max(0, current.stayMinutes - 5) }))} aria-label="머무는 시간 5분 줄이기"><Minus /></button><b>{place.stayMinutes || 0}분</b><button type="button" onClick={() => updatePlace(place.id, (current) => ({ ...current, stayMinutes: current.stayMinutes + 5 }))} aria-label="머무는 시간 5분 늘리기"><Plus /></button></div>}
                  {index > 0 && <div className="guide-place-action-tray"><button type="button" onClick={() => removePlace(place.id)} aria-label={`${place.name} 삭제`}><Trash2 /></button></div>}
                  <div className="guide-place-card" onPointerDown={(event) => startPlaceSwipe(event, place.id)} onPointerMove={movePlaceSwipe} onPointerUp={endPlaceSwipe} onPointerCancel={() => { placeSwipeRef.current = null; }}>
                    <button type="button" className="guide-place-grip" onPointerDown={(event) => startTouchDrag(event, place.id)} onPointerMove={moveTouchDrag} onPointerUp={endTouchDrag} onPointerCancel={endTouchDrag} aria-label={index === 0 ? "출발 위치" : `${place.name} 순서 변경`} disabled={index === 0}><GripVertical aria-hidden="true" /></button>
                    <b>{index + 1}</b><span><strong>{place.name}</strong><small>{index === 0 ? "출발 기준 위치" : place.stayMinutes > 0 ? `머무는 시간 ${place.stayMinutes}분` : "방문할 장소"}</small></span>
                    {index > 0 && <div className="guide-place-hover-actions"><div><button type="button" onClick={() => updatePlace(place.id, (current) => ({ ...current, stayMinutes: Math.max(0, current.stayMinutes - 5) }))} aria-label="머무는 시간 5분 줄이기"><Minus /></button><span><Clock3 />{place.stayMinutes}분</span><button type="button" onClick={() => updatePlace(place.id, (current) => ({ ...current, stayMinutes: current.stayMinutes + 5 }))} aria-label="머무는 시간 5분 늘리기"><Plus /></button></div><button type="button" onClick={() => removePlace(place.id)} aria-label={`${place.name} 삭제`}><Trash2 /></button></div>}
                    {index > 0 && <button type="button" className="guide-place-remove" onClick={() => removePlace(place.id)} aria-label="장소 제거"><Trash2 /></button>}
                  </div>
                </li>;
              })}
            </ol>
            {stage === "calculating" ? <div className="guide-calculating" aria-live="polite"><span /></div> : <button className="guide-calculate" type="button" disabled={!canCalculate} onClick={calculateRoute}><Route aria-hidden="true" />{canCalculate ? "경로 최적화 계산" : "장소를 2곳 이상 추가해 보세요"}</button>}
          </> : <>
            <div className="guide-result-heading"><span><Check aria-hidden="true" /> 최적화 완료</span><button type="button" onClick={() => setStage("places")}><Undo2 aria-hidden="true" /> 다시 해보기</button></div>
            <div className="guide-result-card"><small>예상 소요 시간</small><strong>{estimatedDuration}분</strong><div><span>총 이동 거리 <b>{routeEstimate.distanceKm.toFixed(1)}km</b></span><span>방문 장소 <b>{visitPlaces.length}곳</b></span></div></div>
            <div className="guide-panel-heading result-title"><div><h2>추천 방문 순서</h2></div></div>
            <ol className="guide-result-order">{resultPlaces.map((place, index) => <li key={place.id}><b>{index + 1}</b><span>{place.name}{place.stayMinutes > 0 && <small>{place.stayMinutes}분 머무름</small>}</span></li>)}</ol>
            <p className="guide-success-note"><Check aria-hidden="true" /> 장소 마커를 잇는 경로가 지도 위에 함께 표시됩니다.</p><a className="guide-real-start" href="/">내 장소로 계산 시작하기</a>
          </>}
        </div>
      </section>

      <section className="guide-gesture" aria-labelledby="gesture-title">
        <div className="guide-gesture-copy"><span className="guide-kicker">간단한 조작 팁</span><h2 id="gesture-title">카드를 가로로 밀어보세요.</h2><p>모바일에서 카드를 왼쪽으로 밀면 삭제, 오른쪽으로 밀면 머무는 시간을 조절할 수 있습니다.</p><button type="button" onClick={() => setSwipeOffset((current) => current === 0 ? -112 : 0)}>{swipeOffset === 0 ? "동작 보기" : "카드 닫기"}<ChevronRight aria-hidden="true" /></button></div>
        <div className="guide-swipe-demo"><div className="guide-swipe-actions" aria-hidden="true"><span><Trash2 /></span><span><Clock3 /></span></div><div className="guide-swipe-card" style={{ transform: `translateX(${swipeOffset}px)` }} onPointerDown={handleGestureStart} onPointerMove={handleGestureMove} onPointerUp={handleGestureEnd} onPointerCancel={() => setSwipeOffset(0)}><span className="guide-swipe-grip"><GripVertical aria-hidden="true" /></span><b>2</b><span><strong>방문 장소</strong><small>가로로 밀어 빠른 기능 열기</small></span><span className="guide-swipe-hand"><Hand aria-hidden="true" /></span></div><small className="guide-swipe-hint"><Info aria-hidden="true" /> 가로로 밀면 머무는 시간 설정 및 빠른 기능이 열립니다.</small></div>
      </section>

      <section className="guide-use-cases" aria-labelledby="guide-use-cases-title">
        <div><span className="guide-kicker">여러 장소를 방문하는 모든 날</span><h2 id="guide-use-cases-title">일과 약속 사이, 이동 순서를 더 가볍게 정해 보세요.</h2><p>RouteFit은 여러 방문 장소를 한 번에 정리하고 이동 경로를 확인할 수 있어, 목적이 다른 하루 일정에도 유용합니다.</p></div>
        <ul>
          <li><strong>영업 · 외근 방문</strong><span>거래처, 미팅 장소, 업무 거점을 한 번에 추가해 방문 순서를 확인하세요.</span></li>
          <li><strong>배송 · 현장 업무</strong><span>여러 배송지나 작업 현장을 모아 이동 동선을 빠르게 정리할 수 있습니다.</span></li>
          <li><strong>여행 일정</strong><span>관광지, 식당, 숙소처럼 하루에 들를 곳이 많은 여행 계획에 활용해 보세요.</span></li>
          <li><strong>데이트 · 약속 코스</strong><span>카페, 전시, 식사처럼 여러 약속 장소를 자연스러운 순서로 이어 보세요.</span></li>
        </ul>
      </section>

      <section className="guide-final-cta"><div><h2>이제 내 일정으로 시작해 보세요.</h2><p>장소를 추가하면 RouteFit이 다음 이동 순서를 함께 고민합니다.</p></div><a href="/">경로 계산 시작하기</a></section>
    </main>
  );
}
