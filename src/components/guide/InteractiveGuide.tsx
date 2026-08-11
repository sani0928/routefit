"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BriefcaseBusiness, Check, ChevronRight, GripVertical, Hand, Heart, Info, LockKeyhole, Luggage, MapPin, Route, Search, Trash2, Truck, Undo2 } from "lucide-react";

type GuideStage = "places" | "calculating" | "result";
type GuidePlace = { id: string; name: string; position: { x: number; y: number } };
type GuideFaqMessage = { id: string; role: "question" | "answer"; content: string; email?: string; afterEmail?: string };
type GuideFaqItem = { id: string; question: string; answer: string; email?: string; afterEmail?: string };

const guidePages = [
  { id: "guide-intro", label: "소개" },
  { id: "guide-workspace", label: "체험" },
  { id: "guide-tips", label: "조작 팁" },
  { id: "guide-faq", label: "FAQ" },
] as const;

const guideFaqItems: readonly GuideFaqItem[] = [
  { id: "what-is-routefit", question: "루트핏이 뭐야?", answer: "루트핏(RouteFit)은 여러 방문 장소를 한 번에 정리하고, 이동 거리와 예상 시간을 바탕으로 방문 순서를 확인하는 동선 최적화 서비스예요. 영업이나 외근, 배송, 여행 일정, 데이트 코스처럼 여러 곳을 방문하는 날에 유용해요." },
  { id: "how-to-use", question: "어떻게 사용해?", answer: "장소나 주소를 검색해 방문 장소에 추가한 뒤, 2곳 이상 모이면 경로 최적화 계산 버튼을 눌러 보세요. 추천 방문 순서와 구간별 거리, 예상 시간, 교통 상태를 한눈에 확인할 수 있어요. 공유 기능을 통해 내 동선을 친구와 함께 볼 수도 있어요!" },
  { id: "route-selection-criteria", question: "경로 선택 기준이 뭐야?", answer: "방문 장소의 좌표를 기준으로 출발지에서 가까운 곳부터 이동할 수 있도록 순서를 만들고, 선택된 각 구간은 실제 도로 이동 정보를 조회해 거리와 예상 시간을 계산해요. 여러 장소를 방문할 때 이동 동선을 빠르게 정리할 수 있어요." },
  { id: "stay-time-and-lock", question: "머무는 시간? 자물쇠?", answer: "머무는 시간은 해당 장소에 머물 예상 시간으로, 전체 일정의 도착 예정 시간에 함께 반영돼요. 순서 보장은 원하는 장소를 해당 순서에 고정해 경로를 계산해도 그 순서가 바뀌지 않도록 해줘요." },
  { id: "mobile-use", question: "폰으로도 사용할 수 있어?", answer: "폰에서도 장소 추가, 방문 순서 확인, 경로 계산을 모두 사용할 수 있어요. 설치 안내가 보이면 홈 화면에 추가해 앱처럼 사용할 수도 있어요! iOS 역시 Safari에서 공유 후 홈 화면에 추가해 사용해보세요." },
  { id: "member-benefits", question: "회원 혜택이 뭐야?", answer: "회원은 자주 가는 장소를 장소 리스트로 저장해 다음 일정에 다시 활용할 수 있어요. 방문 장소도 사라지지 않고 유지되기 때문에 동선도 더 빠르게 준비할 수 있어요." },
  { id: "contact", question: "더 궁금한 게 있어!", answer: "궁금한 점이나 문의 사항이 있으면", email: "kksan12@gmail.com", afterEmail: "으로 연락해주세요. 항상 환영합니다!" },
] as const;

const guideUseCases = [
  { id: "sales", title: "영업 · 외근 방문", description: "거래처 미팅 장소, 업무 거점을 한 번에 추가해 방문 순서를 확인하세요.", icon: BriefcaseBusiness },
  { id: "delivery", title: "배송 · 현장 업무", description: "여러 배송지와 작업 현장을 모아 이동 동선을 빠르게 정리할 수 있습니다.", icon: Truck },
  { id: "travel", title: "여행 일정", description: "관광지, 식당, 숙소처럼 하루에 들를 곳이 많은 여행 계획에 사용해 보세요.", icon: Luggage },
  { id: "date", title: "데이트 · 약속 코스", description: "카페, 전시, 식사처럼 여러 약속 장소를 자연스러운 순서로 이어 보세요.", icon: Heart },
] as const;

const initialPlace: GuidePlace = { id: "current-location", name: "현재 위치", position: { x: 16, y: 73 } };
const suggestedPlaces = [
  { id: "city-hall", name: "시청", position: { x: 38, y: 25 } },
  { id: "central-library", name: "중앙도서관", position: { x: 69, y: 69 } },
  { id: "neighborhood-park", name: "근린공원", position: { x: 82, y: 25 } },
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
  const [mobilePage, setMobilePage] = useState(0);
  const [activeUseCaseIndex, setActiveUseCaseIndex] = useState(1);
  const [faqMessages, setFaqMessages] = useState<GuideFaqMessage[]>([{ id: "welcome", role: "answer", content: "궁금한 점을 물어보세요. 루트핏 사용법을 간단히 알려드릴게요." }]);
  const [faqLeavingIds, setFaqLeavingIds] = useState<string[]>([]);
  const [isFaqTyping, setIsFaqTyping] = useState(false);
  const gesturePointerRef = useRef<{ x: number; pointerId: number } | null>(null);
  const useCaseViewportRef = useRef<HTMLDivElement | null>(null);
  const useCaseDragRef = useRef<{ x: number; y: number; scrollLeft: number; pointerId: number; activeIndex: number; isHorizontal: boolean } | null>(null);
  const useCaseSnapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faqTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faqExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visitPlaces = places.slice(1);
  const canCalculate = visitPlaces.length >= 2;
  const visitSetKey = visitPlaces.map((place) => place.id).sort().join("|");
  const routeEstimate = routeEstimates[visitSetKey] ?? { distanceKm: 0, travelMinutes: 0 };
  const optimizedVisits = (optimizedVisitSequences[visitSetKey] ?? visitPlaces.map((place) => place.id))
    .map((id) => visitPlaces.find((place) => place.id === id))
    .filter((place): place is GuidePlace => Boolean(place));
  const resultPlaces = [places[0], ...optimizedVisits];
  const routePath = resultPlaces.map((place, index) => `${index === 0 ? "M" : "L"}${place.position.x} ${place.position.y}`).join(" ");

  const resetResult = () => setStage("places");
  const addSuggestedPlace = (place: (typeof suggestedPlaces)[number]) => {
    if (places.some((current) => current.id === place.id)) return;
    resetResult();
    setPlaces((current) => [...current, place]);
  };
  const removePlace = (id: string) => { resetResult(); setPlaces((current) => current.filter((place) => place.id !== id)); };
  const calculateRoute = () => {
    if (!canCalculate || stage !== "places") return;
    setStage("calculating");
    window.setTimeout(() => setStage("result"), 1100);
  };
  const getGestureRevealWidth = () => window.matchMedia("(max-width: 700px)").matches ? 76 : 112;
  const handleGestureStart = (event: PointerEvent<HTMLDivElement>) => { gesturePointerRef.current = { x: event.clientX, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); };
  const handleGestureMove = (event: PointerEvent<HTMLDivElement>) => { const start = gesturePointerRef.current; if (!start || start.pointerId !== event.pointerId) return; setSwipeOffset(Math.max(-getGestureRevealWidth(), Math.min(0, event.clientX - start.x))); };
  const handleGestureEnd = (event: PointerEvent<HTMLDivElement>) => { const start = gesturePointerRef.current; gesturePointerRef.current = null; if (!start || start.pointerId !== event.pointerId) return; setSwipeOffset(event.clientX - start.x < -44 ? -getGestureRevealWidth() : 0); };
  const getUseCaseNearestIndex = (viewport: HTMLDivElement) => { const viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2; const cards = [...viewport.querySelectorAll<HTMLElement>(".guide-use-case-card")]; return cards.reduce((closest, card, index) => Math.abs(card.getBoundingClientRect().left + card.clientWidth / 2 - viewportCenter) < Math.abs(cards[closest].getBoundingClientRect().left + cards[closest].clientWidth / 2 - viewportCenter) ? index : closest, 0); };
  const focusUseCaseCard = (viewport: HTMLDivElement, index: number, behavior: ScrollBehavior) => { const card = viewport.querySelectorAll<HTMLElement>(".guide-use-case-card")[index]; if (!card) return; const viewportBounds = viewport.getBoundingClientRect(); const cardBounds = card.getBoundingClientRect(); const targetLeft = viewport.scrollLeft + cardBounds.left - viewportBounds.left - (viewport.clientWidth - card.clientWidth) / 2; if (Math.abs(viewport.scrollLeft - targetLeft) > 1) viewport.scrollTo({ left: targetLeft, behavior }); };
  const handleUseCaseScroll = () => { const viewport = useCaseViewportRef.current; if (!viewport) return; const nearestIndex = getUseCaseNearestIndex(viewport); setActiveUseCaseIndex(nearestIndex); if (useCaseSnapTimeoutRef.current) clearTimeout(useCaseSnapTimeoutRef.current); useCaseSnapTimeoutRef.current = setTimeout(() => { const activeViewport = useCaseViewportRef.current; if (!activeViewport) return; focusUseCaseCard(activeViewport, nearestIndex, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"); useCaseSnapTimeoutRef.current = null; }, 90); };
  const handleUseCaseDragStart = (event: PointerEvent<HTMLDivElement>) => { if (event.pointerType === "mouse" && event.button !== 0) return; useCaseDragRef.current = { x: event.clientX, y: event.clientY, scrollLeft: event.currentTarget.scrollLeft, pointerId: event.pointerId, activeIndex: activeUseCaseIndex, isHorizontal: false }; };
  const handleUseCaseDragMove = (event: PointerEvent<HTMLDivElement>) => { const start = useCaseDragRef.current; if (!start || start.pointerId !== event.pointerId) return; const deltaX = event.clientX - start.x; const deltaY = event.clientY - start.y; if (!start.isHorizontal) { if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return; if (Math.abs(deltaY) >= Math.abs(deltaX)) return; start.isHorizontal = true; event.currentTarget.setPointerCapture(event.pointerId); } event.currentTarget.scrollLeft = start.scrollLeft - deltaX; };
  const handleUseCaseDragEnd = (event: PointerEvent<HTMLDivElement>) => { const start = useCaseDragRef.current; useCaseDragRef.current = null; if (!start || start.pointerId !== event.pointerId || !start.isHorizontal) return; const viewport = event.currentTarget; if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId); const cards = [...viewport.querySelectorAll<HTMLElement>(".guide-use-case-card")]; const distance = event.clientX - start.x; const nearestIndex = getUseCaseNearestIndex(viewport); const targetIndex = distance <= -24 ? Math.min(start.activeIndex + 1, cards.length - 1) : distance >= 24 ? Math.max(start.activeIndex - 1, 0) : nearestIndex; setActiveUseCaseIndex(targetIndex); focusUseCaseCard(viewport, targetIndex, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"); };
  const selectFaq = (item: GuideFaqItem) => {
    if (faqTypingTimeoutRef.current || faqExitTimeoutRef.current) return;
    const id = `${item.id}-${Date.now()}`;
    const question: GuideFaqMessage = { id: `${id}-question`, role: "question", content: item.question };
    const answer: GuideFaqMessage = { id: `${id}-answer`, role: "answer", content: item.answer, email: item.email, afterEmail: item.afterEmail };
    const showAnswer = () => {
      setIsFaqTyping(true);
      faqTypingTimeoutRef.current = setTimeout(() => { setFaqMessages((current) => [...current, answer].slice(-4)); setIsFaqTyping(false); faqTypingTimeoutRef.current = null; }, 620);
    };
    if (faqMessages.length < 4) { setFaqMessages((current) => [...current, question]); showAnswer(); return; }
    const leavingIds = faqMessages.slice(0, 2).map((message) => message.id);
    setFaqLeavingIds(leavingIds);
    faqExitTimeoutRef.current = setTimeout(() => { setFaqMessages((current) => [...current.filter((message) => !leavingIds.includes(message.id)), question]); setFaqLeavingIds([]); faqExitTimeoutRef.current = null; showAnswer(); }, 360);
  };

  useEffect(() => () => { if (faqTypingTimeoutRef.current) clearTimeout(faqTypingTimeoutRef.current); if (faqExitTimeoutRef.current) clearTimeout(faqExitTimeoutRef.current); if (useCaseSnapTimeoutRef.current) clearTimeout(useCaseSnapTimeoutRef.current); }, []);
  useEffect(() => { const viewport = useCaseViewportRef.current; if (!viewport) return; requestAnimationFrame(() => focusUseCaseCard(viewport, activeUseCaseIndex, "auto")); }, []);
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".guide-page");
    if (!page || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const index = visible ? guidePages.findIndex((item) => item.id === visible.target.id) : -1;
      if (index >= 0) setMobilePage(index);
    }, { root: page, threshold: [0.55, 0.7] });
    guidePages.forEach(({ id }) => { const section = document.getElementById(id); if (section) observer.observe(section); });
    return () => observer.disconnect();
  }, []);

  const moveToGuidePage = (index: number) => {
    const nextPage = Math.max(0, Math.min(index, guidePages.length - 1));
    setMobilePage(nextPage);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const guidePage = document.querySelector<HTMLElement>(".guide-page");
    const targetSection = document.getElementById(guidePages[nextPage].id);
    if (guidePage && targetSection) {
      guidePage.scrollTo({ top: targetSection.offsetTop, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };
  const renderMap = (withRoute = false) => <div className="guide-map-preview" aria-hidden="true"><div className="guide-map-grid" /><span className="guide-map-road road-one" /><span className="guide-map-road road-two" />{withRoute && <svg className="guide-route-line" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={routePath} fill="none" pathLength="1" /></svg>}{places.map((place, index) => <span className="guide-map-pin" style={{ left: `${place.position.x}%`, top: `${place.position.y}%` }} key={place.id}><b>{withRoute ? resultPlaces.findIndex((candidate) => candidate.id === place.id) + 1 : index + 1}</b><i>{place.name}</i></span>)}</div>;

  return <main className="guide-page">
    <section className="guide-step guide-step-intro" id="guide-intro">
      <header className="guide-nav"><a className="guide-brand" href="/" aria-label="루트핏 RouteFit 홈으로 이동"><img src="/icons/logo.png" alt="루트핏 RouteFit" /></a><a className="guide-nav-start" href="/">내 동선 계산하기</a></header>
      <div className="guide-hero"><span className="guide-kicker">1분 체험 가이드</span><h1>오늘 갈 곳을 추가하고,<br />최적의 동선을 찾아봐요.</h1><p>루트핏은 여러 방문 장소를 순서대로 모아, 이동 경로를 한눈에 확인하도록 돕습니다.<br /> 아래 화면에서 실제 사용 흐름을 미리 체험해 보세요.</p><div className="guide-flow" aria-label="RouteFit 가이드 순서"><span className="active"><b>1</b>소개</span><ChevronRight /><span><b>2</b>체험</span><ChevronRight /><span><b>3</b>활용</span><ChevronRight /><span><b>4</b>자주 묻는 질문</span></div></div>
    </section>

    <section className="guide-step guide-step-workspace" id="guide-workspace" aria-label="방문 장소 추가와 동선 계산 체험"><div className={`guide-workspace${stage === "result" ? " is-result" : ""}`}>
      {renderMap(stage === "result")}
      {stage === "result" ? <div className="guide-panel guide-result-panel"><div className="guide-result-heading"><span><Check /> 최적화 완료</span><button type="button" onClick={resetResult}><Undo2 /> 다시 해보기</button></div><div className="guide-result-card"><small>예상 소요 시간</small><strong>{routeEstimate.travelMinutes}분</strong><div><span>총 이동 거리 <b>{routeEstimate.distanceKm.toFixed(1)}km</b></span><span>방문 장소 <b>{visitPlaces.length}곳</b></span></div></div><div className="guide-panel-heading result-title"><div><h2>추천 방문 순서</h2></div></div><ol className="guide-result-order">{resultPlaces.map((place, index) => <li key={place.id}><b>{index + 1}</b><span>{place.name}</span></li>)}</ol><p className="guide-success-note"><Check /> 지도 위에서 경로를 직접 확인하세요.</p><a className="guide-real-start" href="/">내 장소로 계산 시작하기</a></div> : <div className="guide-panel"><div className="guide-panel-chrome"><span className="active" /><span className={stage === "calculating" ? "active" : ""} /><span /></div><div className="guide-panel-heading"><div><h2>방문 장소 추가</h2></div><span>{visitPlaces.length}곳 추가됨</span></div><p className="guide-panel-copy">검색창은 실제 서비스에서 장소를 찾는 위치입니다.<br />추가한 순서대로 방문 장소가 배치됩니다.</p><div className="guide-search" role="img" aria-label="장소, 주소 검색창 예시"><span className="guide-search-placeholder">장소, 주소 검색</span><span className="guide-search-submit"><Search /></span></div><div className="guide-suggestions" aria-label="예시 장소 추가"><span>예시로 추가</span>{suggestedPlaces.filter((place) => !places.some((current) => current.id === place.id)).map((place) => <button type="button" key={place.id} onClick={() => addSuggestedPlace(place)}><MapPin />{place.name}</button>)}</div><ol className="guide-place-list">{places.map((place, index) => <li key={place.id} data-guide-place-id={place.id} className={`guide-place-item${index === 0 ? " is-start" : ""}`}><div className="guide-place-card"><b>{index + 1}</b><span><strong>{place.name}</strong><small>{index === 0 ? "출발 기준 위치" : "방문할 장소"}</small></span>{index > 0 && <button type="button" className="guide-place-delete" onClick={() => removePlace(place.id)} aria-label={`${place.name} 삭제`}><Trash2 /></button>}</div></li>)}</ol>{stage === "calculating" ? <div className="guide-calculating" aria-live="polite"><span /><strong>가장 효율적인 경로를 계산하고 있어요.</strong></div> : <button className="guide-calculate" type="button" disabled={!canCalculate} onClick={calculateRoute}><Route />{canCalculate ? "경로 최적화 계산" : "장소를 2곳 이상 추가해 보세요."}</button>}</div>}
    </div></section>

    <section className="guide-step guide-step-tips" id="guide-tips" aria-labelledby="gesture-title"><div className="guide-gesture"><div className="guide-gesture-copy"><span className="guide-kicker">간단한 조작 팁</span><h2 id="gesture-title">카드를 가로로 밀어보세요.</h2><p>모바일에서는 카드의 빠른 기능으로 머무는 시간을 조절할 수 있어요.</p><button type="button" onClick={() => setSwipeOffset((current) => current === 0 ? -getGestureRevealWidth() : 0)}>{swipeOffset === 0 ? "동작 보기" : "카드 닫기"}<ChevronRight /></button></div><div className="guide-swipe-demo"><div className="guide-swipe-stage"><div className="guide-swipe-actions"><button type="button" aria-label="장소 삭제"><Trash2 /></button><button type="button" aria-label="방문 순서 보장"><LockKeyhole /></button></div><div className="guide-swipe-card" style={{ transform:`translateX(${swipeOffset}px)` }} onPointerDown={handleGestureStart} onPointerMove={handleGestureMove} onPointerUp={handleGestureEnd} onPointerCancel={() => setSwipeOffset(0)}><span className="guide-swipe-grip"><GripVertical /></span><b>2</b><span><strong>방문 장소</strong><small>가로로 밀면 빠른 기능 확인</small></span><span className="guide-swipe-hand"><Hand /></span></div></div><small className="guide-swipe-hint"><Info /> 가로로 밀면 빠른 기능이 나타납니다.</small></div></div><div className="guide-use-cases"><div><span className="guide-kicker">여러 장소를 방문하는 모든 날</span><h2>외근과 약속 사이, 이동 순서<br />더 가볍게 정해 보세요.</h2><p>RouteFit은 여러 방문 장소를 한 번에 정리하고 이동 경로를 확인할 수 있어, 목적이 다른 하루 일정에도 유용합니다.</p></div><div className="guide-use-case-carousel" role="region" aria-roledescription="carousel" aria-label="활용 사례"><div className="guide-use-case-viewport" ref={useCaseViewportRef} onScroll={handleUseCaseScroll} onPointerDown={handleUseCaseDragStart} onPointerMove={handleUseCaseDragMove} onPointerUp={handleUseCaseDragEnd} onPointerCancel={() => { useCaseDragRef.current = null; }}><div className="guide-use-case-track">{guideUseCases.map((item, index) => { const Icon = item.icon; return <article className={`guide-use-case-card${activeUseCaseIndex === index ? " is-active" : ""}`} key={item.id} aria-hidden={activeUseCaseIndex !== index}><span className="guide-use-case-icon" aria-hidden="true"><Icon /></span><strong>{item.title}</strong><span>{item.description}</span></article>; })}</div></div></div></div></section>

    <section className="guide-step guide-step-faq" id="guide-faq" aria-labelledby="guide-faq-title"><div className="guide-faq"><div className="guide-faq-heading"><span className="guide-kicker">자주 묻는 질문</span><h2 id="guide-faq-title">궁금한 점을 물어보세요.</h2><p>이동 동선부터 회원 혜택까지, 자주 묻는 질문을 모아뒀어요.</p></div><div className="guide-faq-messenger"><div className="guide-faq-chat" aria-live="polite" aria-label="자주 묻는 질문 답변" tabIndex={0}>{faqMessages.map((message) => <p key={message.id} className={`guide-faq-message is-${message.role}${faqLeavingIds.includes(message.id) ? " is-leaving" : ""}`}><span>{message.content}{message.email && <> <a href={`mailto:${message.email}`} className="guide-faq-email">{message.email}</a>{message.afterEmail}</>}</span></p>)}{isFaqTyping && <p className="guide-faq-typing"><span /><span /><span /></p>}</div><div className="guide-faq-questions">{guideFaqItems.map((item) => <button type="button" key={item.id} onClick={() => selectFaq(item)}>{item.question}</button>)}</div></div></div><div className="guide-final-cta"><div><h2>이제 시작해 볼까요?</h2><p>장소를 추가하면 RouteFit이 동선을 빠르게 계산해드려요.</p></div><a href="/">RouteFit 시작하기</a></div></section>

    <nav className="guide-mobile-pagination" aria-label="가이드 페이지 이동"><button type="button" onClick={() => moveToGuidePage(mobilePage - 1)} disabled={mobilePage === 0} aria-label="이전 가이드 페이지"><ChevronRight /></button><div>{guidePages.map((page, index) => <button type="button" key={page.id} className={mobilePage === index ? "active" : ""} aria-label={`${page.label} 페이지로 이동`} aria-current={mobilePage === index ? "page" : undefined} onClick={() => moveToGuidePage(index)}><span /></button>)}</div><button type="button" onClick={() => moveToGuidePage(mobilePage + 1)} disabled={mobilePage === guidePages.length - 1} aria-label="다음 가이드 페이지"><ChevronRight /></button></nav>
  </main>;
}
