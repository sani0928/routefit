"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, GripVertical, Hand, Info, LockKeyhole, Trash2 } from "lucide-react";
import { GuideFaq } from "./GuideFaq";
import { GuideUseCaseCarousel } from "./GuideUseCaseCarousel";
import { GuideWorkspace } from "./GuideWorkspace";
import {
  guideFaqItems,
  guidePages,
  guideRouteEstimates,
  initialGuidePlace,
  optimizedGuideVisitSequences,
  suggestedGuidePlaces,
  type GuideFaqItem,
  type GuideFaqMessage,
  type GuidePlace,
  type GuideStage,
} from "./guide-content";
import { useGuideSwipe } from "./useGuideSwipe";

export function InteractiveGuide() {
  const [places, setPlaces] = useState<GuidePlace[]>([initialGuidePlace]);
  const [stage, setStage] = useState<GuideStage>("places");
  const [mobilePage, setMobilePage] = useState(0);
  const [faqMessages, setFaqMessages] = useState<GuideFaqMessage[]>([
    { id: "welcome", role: "answer", content: "궁금한 점을 물어보세요. 루트핏 사용법을 간단히 알려드릴게요." },
  ]);
  const [faqLeavingIds, setFaqLeavingIds] = useState<string[]>([]);
  const [isFaqTyping, setIsFaqTyping] = useState(false);
  const faqTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faqExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getGestureRevealWidth = () => window.matchMedia("(max-width: 700px)").matches ? 76 : 112;
  const guideSwipe = useGuideSwipe({ getRevealWidth: getGestureRevealWidth });

  const visitPlaces = places.slice(1);
  const canCalculate = visitPlaces.length >= 2;
  const visitSetKey = visitPlaces.map((place) => place.id).sort().join("|");
  const routeEstimate = guideRouteEstimates[visitSetKey] ?? { distanceKm: 0, travelMinutes: 0 };
  const optimizedVisits = (optimizedGuideVisitSequences[visitSetKey] ?? visitPlaces.map((place) => place.id))
    .map((id) => visitPlaces.find((place) => place.id === id))
    .filter((place): place is GuidePlace => Boolean(place));
  const resultPlaces = [places[0], ...optimizedVisits];
  const routePath = resultPlaces.map((place, index) => `${index === 0 ? "M" : "L"}${place.position.x} ${place.position.y}`).join(" ");

  const resetResult = () => setStage("places");
  const addSuggestedPlace = (place: GuidePlace) => {
    if (places.some((current) => current.id === place.id)) return;
    resetResult();
    setPlaces((current) => [...current, place]);
  };
  const removePlace = (id: string) => {
    resetResult();
    setPlaces((current) => current.filter((place) => place.id !== id));
  };
  const calculateRoute = () => {
    if (!canCalculate || stage !== "places") return;
    setStage("calculating");
    window.setTimeout(() => setStage("result"), 1100);
  };
  const selectFaq = (item: GuideFaqItem) => {
    if (faqTypingTimeoutRef.current || faqExitTimeoutRef.current) return;
    const id = `${item.id}-${Date.now()}`;
    const question: GuideFaqMessage = { id: `${id}-question`, role: "question", content: item.question };
    const answer: GuideFaqMessage = { id: `${id}-answer`, role: "answer", content: item.answer, email: item.email, afterEmail: item.afterEmail };
    const showAnswer = () => {
      setIsFaqTyping(true);
      faqTypingTimeoutRef.current = setTimeout(() => {
        setFaqMessages((current) => [...current, answer].slice(-4));
        setIsFaqTyping(false);
        faqTypingTimeoutRef.current = null;
      }, 620);
    };
    if (faqMessages.length < 4) {
      setFaqMessages((current) => [...current, question]);
      showAnswer();
      return;
    }
    const leavingIds = faqMessages.slice(0, 2).map((message) => message.id);
    setFaqLeavingIds(leavingIds);
    faqExitTimeoutRef.current = setTimeout(() => {
      setFaqMessages((current) => [...current.filter((message) => !leavingIds.includes(message.id)), question]);
      setFaqLeavingIds([]);
      faqExitTimeoutRef.current = null;
      showAnswer();
    }, 360);
  };

  useEffect(() => () => {
    if (faqTypingTimeoutRef.current) clearTimeout(faqTypingTimeoutRef.current);
    if (faqExitTimeoutRef.current) clearTimeout(faqExitTimeoutRef.current);
  }, []);
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".guide-page");
    if (!page || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const index = visible ? guidePages.findIndex((item) => item.id === visible.target.id) : -1;
      if (index >= 0) setMobilePage(index);
    }, { root: page, threshold: [0.55, 0.7] });
    guidePages.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  const moveToGuidePage = (index: number) => {
    const nextPage = Math.max(0, Math.min(index, guidePages.length - 1));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const guidePage = document.querySelector<HTMLElement>(".guide-page");
    const targetSection = document.getElementById(guidePages[nextPage].id);
    if (reduceMotion) setMobilePage(nextPage);
    if (guidePage && targetSection) guidePage.scrollTo({ top: targetSection.offsetTop, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return <main className="guide-page">
    <section className="guide-step guide-step-intro" id="guide-intro">
      <header className="guide-nav"><a className="guide-brand" href="/" aria-label="루트핏 RouteFit 홈으로 이동"><img src="/icons/logo.png" alt="루트핏 RouteFit" /></a><a className="guide-nav-start" href="/">내 동선 계산하기</a></header>
      <div className="guide-hero"><span className="guide-kicker">1분 체험 가이드</span><h1>오늘 갈 곳을 추가하고,<br />최적의 동선을 찾아봐요.</h1><p>루트핏은 여러 방문 장소를 순서대로 모아, 이동 경로를 한눈에 확인하도록 돕습니다.<br />아래 화면에서 실제 사용 흐름을 미리 체험해 보세요.</p><div className="guide-flow" aria-label="RouteFit 가이드 순서"><span className="active"><b>1</b>소개</span><ChevronRight /><span><b>2</b>체험</span><ChevronRight /><span><b>3</b>활용</span><ChevronRight /><span><b>4</b>자주 묻는 질문</span></div></div>
    </section>

    <GuideWorkspace places={places} resultPlaces={resultPlaces} stage={stage} routePath={routePath} visitPlaceCount={visitPlaces.length} routeEstimate={routeEstimate} suggestedPlaces={suggestedGuidePlaces} onAddPlace={addSuggestedPlace} onRemovePlace={removePlace} onCalculate={calculateRoute} onResetResult={resetResult} />

    <section className="guide-step guide-step-tips" id="guide-tips" aria-labelledby="gesture-title">
      <div className="guide-gesture">
        <div className="guide-gesture-copy"><span className="guide-kicker">간단한 조작 팁</span><h2 id="gesture-title">카드를 가로로 밀어보세요.</h2><p>모바일에서는 좌우로 스와이프해 빠른 기능을 이용할 수 있어요.</p><button type="button" onClick={() => guideSwipe.setOffset((current) => current === 0 ? -getGestureRevealWidth() : 0)}>{guideSwipe.offset === 0 ? "동작 보기" : "카드 닫기"}<ChevronRight /></button></div>
        <div className="guide-swipe-demo"><div className="guide-swipe-stage"><div className="guide-swipe-actions"><button type="button" aria-label="장소 삭제"><Trash2 /></button><button type="button" aria-label="방문 순서 보장"><LockKeyhole /></button></div><div className="guide-swipe-card" style={{ transform: `translateX(${guideSwipe.offset}px)` }} {...guideSwipe.handlers}><span className="guide-swipe-grip"><GripVertical /></span><b>2</b><span><strong>방문 장소</strong><small>가로로 밀면 빠른 기능 확인</small></span><span className="guide-swipe-hand"><Hand /></span></div></div><small className="guide-swipe-hint"><Info /> 가로로 밀면 빠른 기능이 나타납니다.</small></div>
      </div>
      <div className="guide-use-cases"><div><span className="guide-kicker">여러 장소를 방문하는 모든 날</span><h2>외근과 약속 사이, 이동 순서<br />더 가볍게 정해 보세요.</h2><p>RouteFit은 여러 방문 장소를 한 번에 정리하고 이동 경로를 확인할 수 있어, 목적이 다른 하루 일정에도 유용합니다.</p></div><GuideUseCaseCarousel /></div>
    </section>

    <GuideFaq messages={faqMessages} leavingIds={faqLeavingIds} isTyping={isFaqTyping} items={guideFaqItems} onSelect={selectFaq} />
    <nav className="guide-mobile-pagination" aria-label="가이드 페이지 이동"><button type="button" onClick={() => moveToGuidePage(mobilePage - 1)} disabled={mobilePage === 0} aria-label="이전 가이드 페이지"><ChevronRight /></button><div>{guidePages.map((page, index) => <button type="button" key={page.id} className={mobilePage === index ? "active" : ""} aria-label={`${page.label} 페이지로 이동`} aria-current={mobilePage === index ? "page" : undefined} onClick={() => moveToGuidePage(index)}><span /></button>)}</div><button type="button" onClick={() => moveToGuidePage(mobilePage + 1)} disabled={mobilePage === guidePages.length - 1} aria-label="다음 가이드 페이지"><ChevronRight /></button></nav>
  </main>;
}
