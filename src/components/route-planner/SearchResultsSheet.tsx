"use client";

import { ListPlus, LoaderCircle, MapPin, MapPinPlus, MapPinX, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaceSearchResponse, PlaceSearchResult } from "@/features/place-search/types";
import { PlaceCategoryIcon } from "./PlaceCategoryIcon";
import { formatSearchDistance } from "./place-search-format";

type Coordinates = { latitude: number; longitude: number };
type SearchSort = "accuracy" | "current-distance" | "map-center-distance";
type AddPlaceResult = { added: boolean; message?: string };
type SaveableSearchResult = PlaceSearchResult & { providerId: string };

type Props = {
  query: string | null;
  currentLocation?: Coordinates | null;
  mapCenter?: Coordinates | null;
  mapCenterFilter?: Coordinates | null;
  mapCenterRequestId?: number;
  isCurrentLocationLocating: boolean;
  isPlaceAdded: (place: PlaceSearchResult) => boolean;
  onAdd: (place: PlaceSearchResult) => AddPlaceResult;
  onRemove: (place: PlaceSearchResult) => void;
  onSave?: (place: SaveableSearchResult) => void;
  onResultsChange?: (results: PlaceSearchResult[]) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  onResultFocus?: (place: PlaceSearchResult) => void;
  onSearchContextChange?: () => void;
  onSortChange?: (sort: SearchSort, center?: Coordinates | null) => void;
  onRequestCurrentLocation: () => boolean;
};

const PAGE_SIZE = 20;
const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "accuracy", label: "관련도" },
  { value: "current-distance", label: "현재 위치" },
  { value: "map-center-distance", label: "지도 중심" },
];

function resultKey(place: PlaceSearchResult) {
  return place.providerId ?? `${place.name}:${place.latitude.toFixed(6)}:${place.longitude.toFixed(6)}`;
}

export function SearchResultsSheet({ query, currentLocation, mapCenter, mapCenterFilter, mapCenterRequestId = 0, isCurrentLocationLocating, isPlaceAdded, onAdd, onRemove, onSave, onResultsChange, onLoadingChange, onResultFocus, onSearchContextChange, onSortChange, onRequestCurrentLocation }: Props) {
  const [sort, setSort] = useState<SearchSort>("accuracy");
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isInitialLoading, setInitialLoading] = useState(false);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [isEnd, setIsEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const nextPageRef = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const locationRequestStartedRef = useRef(false);
  const searchContextChangeRef = useRef(onSearchContextChange);

  useEffect(() => {
    searchContextChangeRef.current = onSearchContextChange;
  }, [onSearchContextChange]);

  const basis = sort === "current-distance" ? currentLocation : sort === "map-center-distance" ? mapCenterFilter : null;
  const requestKey = useMemo(() => query ? [query, sort, basis?.latitude.toFixed(6) ?? "", basis?.longitude.toFixed(6) ?? "", sort === "map-center-distance" ? mapCenterRequestId : ""].join("|") : "", [basis?.latitude, basis?.longitude, mapCenterRequestId, query, sort]);

  const fetchPage = useCallback(async (page: number, reset: boolean) => {
    if (!query || (sort !== "accuracy" && !basis)) return;
    const requestVersion = requestVersionRef.current;
    const controller = new AbortController();
    if (reset) abortRef.current?.abort();
    abortRef.current = controller;
    if (reset) setInitialLoading(true); else setLoadingMore(true);
    setError(null);

    try {
      const params = new URLSearchParams({ query, page: String(page), size: String(PAGE_SIZE), sort: sort === "accuracy" ? "accuracy" : "distance" });
      if (basis) {
        params.set("x", String(basis.longitude));
        params.set("y", String(basis.latitude));
      }
      const response = await fetch(`/api/places/search?${params}`, { signal: controller.signal });
      const body = await response.json() as PlaceSearchResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "검색 결과를 불러오지 못했습니다.");
      if (requestVersion !== requestVersionRef.current) return;

      const incoming = body.results ?? [];
      setResults((current) => {
        const merged = reset ? incoming : [...current, ...incoming];
        const keys = new Set<string>();
        return merged.filter((place) => {
          const key = resultKey(place);
          if (keys.has(key)) return false;
          keys.add(key);
          return true;
        });
      });
      nextPageRef.current = page + 1;
      setIsEnd(body.isEnd || incoming.length === 0);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (requestVersion !== requestVersionRef.current) return;
      setError(caught instanceof Error ? caught.message : "검색 결과를 불러오지 못했습니다.");
      if (reset) setResults([]);
    } finally {
      if (requestVersion === requestVersionRef.current && !controller.signal.aborted) {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    }
  }, [basis, query, sort]);

  useEffect(() => {
    requestVersionRef.current += 1;
    abortRef.current?.abort();
    nextPageRef.current = 1;
    // A new query, sort order, or distance basis represents a different result
    // set. Clear the previous row focus before moving to the next first result.
    searchContextChangeRef.current?.();
    setResults([]);
    setIsEnd(false);
    setError(null);
    if (!query || (sort !== "accuracy" && !basis)) return;
    void fetchPage(1, true);
    return () => abortRef.current?.abort();
  }, [basis, fetchPage, query, requestKey, sort]);

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  useEffect(() => {
    onLoadingChange?.(isInitialLoading || isLoadingMore);
  }, [isInitialLoading, isLoadingMore, onLoadingChange]);

  useEffect(() => {
    if (!waitingForLocation) return;
    if (currentLocation) {
      locationRequestStartedRef.current = false;
      setWaitingForLocation(false);
      onSortChange?.("current-distance");
      setSort("current-distance");
      return;
    }
    if (isCurrentLocationLocating) locationRequestStartedRef.current = true;
    if (locationRequestStartedRef.current && !isCurrentLocationLocating) {
      locationRequestStartedRef.current = false;
      setWaitingForLocation(false);
    }
  }, [currentLocation, isCurrentLocationLocating, waitingForLocation, onSortChange]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !query || isEnd || isInitialLoading || isLoadingMore || (sort !== "accuracy" && !basis)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || isEnd || isLoadingMore || isInitialLoading) return;
      void fetchPage(nextPageRef.current, false);
    }, { root: window.matchMedia("(max-width: 700px)").matches ? null : scrollRef.current, rootMargin: "180px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [basis, fetchPage, isEnd, isInitialLoading, isLoadingMore, query, results.length, sort]);

  if (!query) return null;

  function selectSort(nextSort: SearchSort) {
    if (nextSort === "current-distance" && !currentLocation) {
      if (onRequestCurrentLocation()) setWaitingForLocation(true);
      return;
    }
    if (nextSort === "map-center-distance" && !mapCenter) return;
    setWaitingForLocation(false);
    onSortChange?.(nextSort, nextSort === "map-center-distance" ? mapCenter : undefined);
    setSort(nextSort);
  }

  const isDistanceSort = sort !== "accuracy";
  return <section className="search-results-sheet" aria-label="전체 검색 결과">
    <div className="search-results-sort" aria-label="검색 결과 정렬">
      <SlidersHorizontal size={16} aria-hidden="true" />
      {SORT_OPTIONS.map((option) => <button key={option.value} type="button" className={sort === option.value ? "selected" : ""} onClick={() => selectSort(option.value)}>{option.label}</button>)}
    </div>
    <div className="search-results-sheet-list" ref={scrollRef}>
      {isInitialLoading && <div className="search-results-state"><LoaderCircle className="spin" size={24} /><p>검색 결과를 불러오는 중입니다.</p></div>}
      {!isInitialLoading && error && <div className="search-results-state error"><p>{error}</p><button type="button" onClick={() => void fetchPage(1, true)}>다시 시도</button></div>}
      {!isInitialLoading && !error && results.length === 0 && <div className="search-results-state"><Search size={26} /><p>검색 결과가 없습니다.</p></div>}
      {results.map((place) => {
        const added = isPlaceAdded(place);
        const distance = isDistanceSort ? formatSearchDistance(place.distanceMeters) : null;
        return <article className="search-results-sheet-item" key={resultKey(place)} role={onResultFocus ? "button" : undefined} tabIndex={onResultFocus ? 0 : undefined} onClick={() => onResultFocus?.(place)} onKeyDown={(event) => {
          if (onResultFocus && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onResultFocus(place);
          }
        }}>
          <PlaceCategoryIcon code={place.categoryGroupCode} className="search-results-sheet-icon" />
          <div className="search-results-sheet-copy"><strong>{place.name}</strong><small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small>{distance && <span><MapPin size={13} /> {distance}</span>}</div>
          <div className="search-results-sheet-actions">
            <button type="button" className={`search-results-route-action${added ? " is-on-route" : ""}`} onClick={(event) => { event.stopPropagation(); if (added) onRemove(place); else onAdd(place); }} title={added ? "방문 장소 제거" : "방문 장소 추가"} aria-label={`${place.name} ${added ? "방문 장소 제거" : "방문 장소 추가"}`}>{added ? <MapPinX size={16} /> : <MapPinPlus size={16} />}</button>
            {onSave && place.providerId && <button type="button" className="save" onClick={(event) => { event.stopPropagation(); onSave({ ...place, providerId: place.providerId! }); }} aria-label={`${place.name} 장소 리스트에 저장`}><ListPlus size={17} /></button>}
          </div>
        </article>;
      })}
      {!isInitialLoading && !error && results.length > 0 && <div ref={sentinelRef} className="search-results-sentinel">{isLoadingMore && <><LoaderCircle className="spin" size={18} /> 결과를 더 불러오는 중입니다.</>}{isEnd && "모든 검색 결과를 확인했습니다."}</div>}
    </div>
  </section>;
}
