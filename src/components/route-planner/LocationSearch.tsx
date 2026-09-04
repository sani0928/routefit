"use client";

import { List, ListPlus, Search, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { notify } from "@/lib/notify";
import type { PlaceSearchResponse, PlaceSearchResult } from "@/features/place-search/types";
import type { MemberPlaceList } from "@/features/member/types";
import { PlaceCategoryIcon } from "./PlaceCategoryIcon";

type Feedback = "idle" | "not-found" | "error";
type AddPlaceResult = { added: boolean; message?: string };
type SaveableSearchResult = PlaceSearchResult & { providerId: string };

const RECENT_SEARCHES_STORAGE_KEY = "routefit-recent-searches";
const MAX_RECENT_SEARCHES = 10;
const MAX_VISIBLE_RECENT_SEARCHES = 5;

type Props = {
  onAdd: (place: PlaceSearchResult) => AddPlaceResult;
  onSave?: (place: SaveableSearchResult) => void;
  placeLists: MemberPlaceList[];
  savedListIdsByProviderId: Record<string, string[]>;
  isSaveDialogOpen?: boolean;
  onSearchSubmit: (query: string) => void;
  onSearchFocus?: () => void;
  onSavedPlacesOpen?: () => void;
  onSearchClear?: () => void;
  onResultsLoaded?: (results: PlaceSearchResult[]) => void;
  showClearAction?: boolean;
  mobileAction?: ReactNode;
};

export function LocationSearch({ onAdd, onSave, placeLists, savedListIdsByProviderId, isSaveDialogOpen = false, onSearchSubmit, onSearchFocus, onSavedPlacesOpen, onSearchClear, onResultsLoaded, showClearAction = false, mobileAction }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [isExpanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const searchRootRef = useRef<HTMLFormElement>(null);

  function showFeedback(type: Exclude<Feedback, "idle">) {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setFeedback(type);
    notify[type === "not-found" ? "info" : "error"](type === "not-found" ? "검색 결과가 없습니다." : "장소 검색에 실패했습니다.");
    feedbackTimerRef.current = window.setTimeout(() => setFeedback("idle"), 720);
  }

  function clearSearch() {
    abortRef.current?.abort();
    setQuery("");
    setResults([]);
    setLoading(false);
    setFeedback("idle");
    setExpanded(false);
    onSearchClear?.();
  }

  function rememberSearch(term: string) {
    const keyword = term.trim();
    if (keyword.length < 2) return;

    setRecentSearches((current) => {
      const normalizedKeyword = keyword.toLowerCase();
      const next = [keyword, ...current.filter((item) => item.toLowerCase() !== normalizedKeyword)].slice(0, MAX_RECENT_SEARCHES);
      try {
        window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Recent searches are a convenience only; continue when storage is unavailable.
      }
      return next;
    });
  }

  function removeRecentSearch(keyword: string) {
    setRecentSearches((current) => {
      const next = current.filter((item) => item !== keyword);
      try {
        if (next.length) window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
        else window.localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
      } catch {
        // Recent searches are a convenience only; continue when storage is unavailable.
      }
      return next;
    });
  }

  function submitSearch(term: string) {
    const keyword = term.trim();
    if (keyword.length < 2) return;
    rememberSearch(keyword);
    setExpanded(false);
    // A mobile results view uses the compact sheet, so keep the software keyboard
    // from covering it after the search form submits.
    if (isMobile) searchRootRef.current?.querySelector<HTMLInputElement>("#search")?.blur();
    onSearchSubmit(keyword);
  }

  function choose(place: PlaceSearchResult) {
    const outcome = onAdd(place);
    if (outcome.added) setExpanded(false);
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 700px)");
    const syncMobileState = () => setIsMobile(mediaQuery.matches);
    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);
    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY) ?? "[]") as unknown;
      if (!Array.isArray(stored)) return;
      setRecentSearches(stored
        .filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
        .map((item) => item.trim())
        .slice(0, MAX_RECENT_SEARCHES));
    } catch {
      // Ignore malformed or unavailable browser storage.
    }
  }, []);

  useEffect(() => {
    const term = query.trim();
    abortRef.current?.abort();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setFeedback("idle");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/places/search?query=${encodeURIComponent(term)}&page=1&size=5&sort=accuracy`, { signal: controller.signal });
        const body = await response.json() as PlaceSearchResponse & { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message || "장소 검색에 실패했습니다.");
        const next = body.results ?? [];
        setResults(next);
        onResultsLoaded?.(next);
        if (!next.length) showFeedback("not-found");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        showFeedback("error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [onResultsLoaded, query]);

  useEffect(() => () => { if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current); }, []);
  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!isExpanded || isSaveDialogOpen || searchRootRef.current?.contains(event.target as Node)) return;
      setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [isExpanded, isSaveDialogOpen]);

  function submit(event: FormEvent) {
    event.preventDefault();
    submitSearch(query);
  }

  const isShowingRecentSearches = isExpanded && !query.trim() && recentSearches.length > 0;
  const isShowingQuickResults = isExpanded && query.trim().length >= 2 && results.length > 0;

  return <form ref={searchRootRef} onSubmit={submit} className={`search-form naver-search-form${isExpanded || query ? " search-expanded" : ""}`}>
    <label className="sr-only" htmlFor="search">장소 또는 주소 검색</label>
    <div className="search-control">
      <div className={`search-input-row ${feedback !== "idle" ? `search-feedback ${feedback}` : ""}`}>
        <input id="search" value={query} onFocus={() => { setExpanded(true); onSearchFocus?.(); }} onBlur={() => { if (!query.trim()) clearSearch(); }} onChange={(event) => { setQuery(event.target.value); setExpanded(true); }} placeholder="장소, 주소 검색" autoComplete="off" aria-expanded={isShowingQuickResults || isShowingRecentSearches} aria-controls={isShowingRecentSearches ? "recent-search-keywords" : "place-search-results"} />
        {(query || showClearAction) && <button className="search-clear" type="button" aria-label="검색 결과 닫기" onClick={clearSearch}><X size={16} /></button>}
        <button className="search-submit" type="submit" aria-label="전체 검색 결과 보기" disabled={query.trim().length < 2 || loading}><Search size={18} /></button>
      </div>
      {isShowingQuickResults && <ul id="place-search-results" className="search-results" role="listbox">
        {results.map((place, index) => {
          const savedListIds = place.providerId ? savedListIdsByProviderId[place.providerId] ?? place.savedListIds : place.savedListIds;
          const placeListMatch = savedListIds?.length
            ? placeLists.find((list) => savedListIds.includes(list.id))
            : undefined;
          return <li key={place.providerId ?? `${place.name}-${place.latitude}-${place.longitude}`} role="option" aria-selected={index === 0}>
          <button type="button" className="search-result-add" onClick={() => choose(place)}><PlaceCategoryIcon code={place.categoryGroupCode} className="search-result-category-icon" /><span className="search-result-quick-copy"><strong><b className="search-result-place-name">{place.name}</b>{placeListMatch && <i className="search-result-list-badge" style={{ "--list-color": placeListMatch.color } as CSSProperties}><List size={10} aria-hidden="true" /><span>{placeListMatch.name}</span></i>}</strong><small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small></span></button>
          {onSave && place.providerId && <button className="search-result-save" type="button" onClick={() => onSave({ ...place, providerId: place.providerId! })} aria-label={`${place.name} 장소 리스트에 저장`}><ListPlus size={16} /></button>}
        </li>;
        })}
      </ul>}
      {isShowingRecentSearches && <ul id="recent-search-keywords" className="recent-searches" aria-label="최근 검색어">
        <li className="recent-searches-heading"><span>최근 검색어</span></li>
        {recentSearches.slice(0, MAX_VISIBLE_RECENT_SEARCHES).map((keyword) => <li className="recent-searches-item" key={keyword}>
          <button className="recent-search-select" type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => { setQuery(keyword); submitSearch(keyword); }}><Search size={18} aria-hidden="true" /><span>{keyword}</span></button>
          <button className="recent-search-remove" type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => removeRecentSearch(keyword)} aria-label={`${keyword} 최근 검색어 삭제`}><X size={16} aria-hidden="true" /></button>
        </li>)}
      </ul>}
    </div>
    {onSavedPlacesOpen && <button type="button" className="search-list-toggle" onClick={onSavedPlacesOpen} aria-label="장소 리스트 열기"><List size={18} aria-hidden="true" /><span>장소 리스트</span></button>}
    {isMobile && mobileAction}
  </form>;
}
