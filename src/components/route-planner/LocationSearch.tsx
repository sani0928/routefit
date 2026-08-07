"use client";

import { ListPlus, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import type { Place } from "@/features/route-optimization/types/route.types";
import { PlaceCategoryIcon } from "./PlaceCategoryIcon";

type SearchResult = Omit<Place, "id" | "type"> & { categoryName?: string; categoryGroupCode?: string; categoryGroupName?: string; };
type Feedback = "idle" | "not-found" | "error";
type AddPlaceResult = { added: boolean; message?: string };

export function LocationSearch({ onAdd, onSave, onSearchFocus, onSearchPointerDown }: { onAdd: (place: SearchResult) => AddPlaceResult; onSave?: (place: SearchResult) => void; onSearchFocus?: () => void; onSearchPointerDown?: () => void }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<SearchResult[]>([]); const [loading, setLoading] = useState(false); const [hasSearched, setHasSearched] = useState(false); const [feedback, setFeedback] = useState<Feedback>("idle"); const [isExpanded, setExpanded] = useState(false); const [isMobile, setIsMobile] = useState(false);
  const abortRef = useRef<AbortController | null>(null); const feedbackTimerRef = useRef<number | null>(null); const resultsCacheRef = useRef(new Map<string, SearchResult[]>()); const searchRootRef = useRef<HTMLFormElement>(null);
  function showFeedback(type: Exclude<Feedback, "idle">) { if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current); setFeedback(type); notify[type === "not-found" ? "info" : "error"](type === "not-found" ? "검색 결과가 없습니다." : "장소 검색에 실패했습니다."); navigator.vibrate?.(type === "not-found" ? [8, 24, 8] : 18); feedbackTimerRef.current = window.setTimeout(() => setFeedback("idle"), 720); }
  function clearSearch() { abortRef.current?.abort(); setQuery(""); setResults([]); setLoading(false); setHasSearched(false); setFeedback("idle"); setExpanded(false); }
  function choose(place: SearchResult) { const outcome = onAdd(place); if (!outcome.added) return; setExpanded(false); }
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 700px)");
    const syncMobileState = () => setIsMobile(mediaQuery.matches);
    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);
    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);
  useEffect(() => {
    const term = query.trim();
    abortRef.current?.abort();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      setFeedback("idle");
      return;
    }

    const cached = resultsCacheRef.current.get(term);
    if (cached) {
      setResults(cached);
      setLoading(false);
      setHasSearched(true);
      setFeedback("idle");
      return;
    }

    setHasSearched(false);
    setFeedback("idle");
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/places/search?query=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = await response.json() as { results?: SearchResult[]; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message || "장소 검색에 실패했습니다.");
        const next = (body.results ?? []).slice(0, 10);
        resultsCacheRef.current.set(term, next);
        setResults(next);
        setHasSearched(true);
        if (!next.length) showFeedback("not-found");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setHasSearched(false);
        showFeedback("error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 100);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => () => { if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current); }, []);
  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!isExpanded || searchRootRef.current?.contains(event.target as Node)) return;
      setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [isExpanded]);  function submit(event: FormEvent) { event.preventDefault(); if (results[0]) choose(results[0]); else if (query.trim().length >= 2 && !loading) showFeedback(hasSearched ? "not-found" : "error"); }
  return <form ref={searchRootRef} onSubmit={submit} className={`search-form naver-search-form${isExpanded || query ? " search-expanded" : ""}`}><label className="sr-only" htmlFor="search">장소 또는 주소 검색</label><div className="search-control"><div className={`search-input-row ${feedback !== "idle" ? `search-feedback ${feedback}` : ""}`}><input id="search" value={query} onPointerDown={() => onSearchPointerDown?.()} onFocus={() => { setExpanded(true); onSearchFocus?.(); }} onBlur={() => { if (!query.trim()) setExpanded(false); }} onChange={(event) => { setQuery(event.target.value); if (event.target.value) setExpanded(true); }} placeholder="장소, 주소 검색" autoComplete="off" aria-expanded={isExpanded && results.length > 0} aria-controls="place-search-results" />{query && <button className="search-clear" type="button" aria-label="검색어 지우기" onClick={clearSearch}><X size={16} /></button>}</div>{isExpanded && results.length > 0 && <ul id="place-search-results" className="search-results" role="listbox">{results.map((place, index) => <li key={`${place.name}-${place.latitude}-${place.longitude}`} role="option" aria-selected={index === 0}><button type="button" className="search-result-add" onClick={() => choose(place)}><PlaceCategoryIcon code={place.categoryGroupCode} className="search-result-category-icon" /><span><strong>{place.name}</strong><small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small></span></button>{onSave && <button className="search-result-save" type="button" onClick={() => onSave(place)} aria-label={`${place.name} 장소 리스트에 저장`}><ListPlus size={16} /></button>}</li>)}</ul>}</div>{isMobile && <div className="search-brand" aria-hidden="true"><img src="/icons/logo.png" alt="" /></div>}</form>;
}