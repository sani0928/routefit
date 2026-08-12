"use client";

import { useEffect, useRef, useState } from "react";
import { guideUseCases } from "./guide-content";
import { useGuidePointerDrag } from "./useGuideSwipe";

export function GuideUseCaseCarousel() {
  const [activeIndex, setActiveIndex] = useState(1);
  const [translate, setTranslate] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ activeIndex: number; translate: number } | null>(null);

  const getTranslate = (viewport: HTMLDivElement, index: number) => {
    const card = viewport.querySelectorAll<HTMLElement>(".guide-use-case-card")[index];
    return card ? viewport.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2) : 0;
  };
  const focusCard = (viewport: HTMLDivElement, index: number) => setTranslate(getTranslate(viewport, index));
  const pointerDrag = useGuidePointerDrag({
    onStart: () => {
      dragRef.current = { activeIndex, translate };
      setIsDragging(true);
    },
    onMove: (event, pointer) => {
      const start = dragRef.current;
      if (start) setTranslate(start.translate + event.clientX - pointer.x);
    },
    onEnd: (event, pointer) => {
      const start = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      if (!start) return;
      const distance = event.clientX - pointer.x;
      const targetIndex = distance <= -44
        ? Math.min(start.activeIndex + 1, guideUseCases.length - 1)
        : distance >= 44
          ? Math.max(start.activeIndex - 1, 0)
          : start.activeIndex;
      setActiveIndex(targetIndex);
      focusCard(event.currentTarget, targetIndex);
    },
    onCancel: () => {
      dragRef.current = null;
      setIsDragging(false);
    },
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const align = () => focusCard(viewport, activeIndex);
    const frame = requestAnimationFrame(align);
    window.addEventListener("resize", align);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", align);
    };
  }, [activeIndex]);

  return <div className="guide-use-case-carousel" role="region" aria-roledescription="carousel" aria-label="활용 사례">
    <div className="guide-use-case-viewport" ref={viewportRef} {...pointerDrag.handlers}>
      <div className={`guide-use-case-track${isDragging ? " is-dragging" : ""}`} style={{ transform: `translateX(${translate}px)` }}>
        {guideUseCases.map((item, index) => <article className={`guide-use-case-card${activeIndex === index ? " is-active" : ""}`} key={item.id} aria-hidden={activeIndex !== index}><strong>{item.title}</strong><span>{item.description}</span></article>)}
      </div>
    </div>
  </div>;
}

