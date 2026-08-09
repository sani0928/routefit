"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { List, MapPin, Waypoints } from "lucide-react";
import { MapView } from "@/components/map/MapView";
import { MemberHeader } from "@/components/member/MemberHeader";
import { SavePlaceDialog } from "@/components/member/SavePlaceDialog";
import { SavedPlacesPanel } from "@/components/member/SavedPlacesPanel";
import { LocationSearch } from "@/components/route-planner/LocationSearch";
import { SearchResultsSheet } from "@/components/route-planner/SearchResultsSheet";
import { PlaceList } from "@/components/route-planner/PlaceList";
import { RouteSummary } from "@/components/route-planner/RouteSummary";
import type { MemberPlaceList, MemberState, SavedPlace } from "@/features/member/types";
import type { FixedVisitOrder, OptimizationResponse, Place } from "@/features/route-optimization/types/route.types";
import { notify } from "@/lib/notify";
import { useMobileSheetController } from "@/hooks/useMobileSheetController";
import type { PlaceSearchResult } from "@/features/place-search/types";

type Status = "IDLE" | "BUILDING_MATRIX" | "OPTIMIZING" | "FETCHING_FINAL_ROUTE" | "SUCCESS" | "ERROR";
type PlaceInput = Omit<Place, "id" | "type">;
type SavePlaceInput = PlaceInput & { categoryGroupCode?: string };
type MobileTab = "places" | "lists" | "results";
type MobileSheetState = "collapsed" | "peek" | "expanded";
type AddPlaceResult = { added: boolean; message?: string };

type LocationCoordinates = Pick<Place, "latitude" | "longitude">;
const CURRENT_LOCATION_RECALCULATE_DISTANCE_METERS = 150;
const EMPTY_MEMBER: MemberState = { authenticated: false, authConfigured: false, placeLists: [] };
const newId = () => crypto.randomUUID();
const GUEST_WORKSPACE_KEY = "routefit-guest-workspace";
const WEB_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "RouteFit",
  alternateName: "루트핏",
  url: "https://www.routefit.co.kr/",
  description: "실시간 교통정보를 반영해 여러 방문 장소의 이동 경로를 쉽고 빠르게 최적화하는 웹 서비스",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web browser",
  inLanguage: "ko-KR",
  image: "https://www.routefit.co.kr/images/og_image.png",
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  featureList: ["여러 방문 장소 추가", "방문 순서 최적화", "실시간 교통정보 기반 경로 계산"],
};
type RouteResultSnapshot = {
  returnToStart: boolean;
  fixedVisitOrders: FixedVisitOrder[];
};
type SearchResultSort = "accuracy" | "current-distance" | "map-center-distance";

type WorkspaceSnapshot = {
  returnToStart: boolean;
  places: Place[];
  fixedVisitOrders: FixedVisitOrder[];
};

function readGuestWorkspace(): WorkspaceSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(GUEST_WORKSPACE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (typeof value.returnToStart !== "boolean" || !Array.isArray(value.places) || !Array.isArray(value.fixedVisitOrders)) return null;
    return { returnToStart: value.returnToStart, places: value.places, fixedVisitOrders: value.fixedVisitOrders };
  } catch {
    return null;
  }
}
const normalizePlaceRoles = (items: Place[]) => {
  return items.map((place, index) => ({
    ...place,
    ...(place.isCurrentLocation ? { isCurrentLocation: true, stayDurationMinutes: 0 } : {}),
    type: index === 0 ? "START" as const : "WAYPOINT" as const,
  }));
};
function distanceInMeters(first: LocationCoordinates, second: LocationCoordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(first.latitude)) * Math.cos(toRadians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isFixedOrderValid(fixed: FixedVisitOrder, items: Place[]) {
  const index = items.findIndex((place) => place.id === fixed.placeId);
  return index > 0 && fixed.visitOrder >= 2 && fixed.visitOrder <= items.length;
}

type MobileSheetHandleProps = {
  expanded: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onStep: (direction: "up" | "down") => void;
};

function MobileSheetHandle({ expanded, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onStep }: MobileSheetHandleProps) {
  return <button
    type="button"
    className="mobile-sheet-handle"
    aria-label="콘텐츠 패널 높이 조절"
    aria-expanded={expanded}
    onPointerDown={(event) => { event.stopPropagation(); onPointerDown(event); }}
    onPointerMove={(event) => { event.stopPropagation(); onPointerMove(event); }}
    onPointerUp={(event) => { event.stopPropagation(); onPointerUp(event); }}
    onPointerCancel={(event) => { event.stopPropagation(); onPointerCancel(event); }}
    onKeyDown={(event) => {
      if (event.key === "ArrowUp") { event.preventDefault(); onStep("up"); }
      if (event.key === "ArrowDown") { event.preventDefault(); onStep("down"); }
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onStep(expanded ? "down" : "up"); }
    }}
  >
    <span aria-hidden="true" />
  </button>;
}

export default function Home() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [returnToStart, setReturnToStart] = useState(true);
  const [fixedVisitOrders, setFixedVisitOrders] = useState<FixedVisitOrder[]>([]);
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [resultSnapshot, setResultSnapshot] = useState<RouteResultSnapshot | null>(null);
  const [routeNeedsRecalculation, setRouteNeedsRecalculation] = useState(false);
  const [status, setStatus] = useState<Status>("IDLE");
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [member, setMember] = useState<MemberState>(EMPTY_MEMBER);
  const [memberStateReady, setMemberStateReady] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [currentLocationLocating, setCurrentLocationLocating] = useState(false);
  const [currentLocationRequestId, setCurrentLocationRequestId] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [searchMapResults, setSearchMapResults] = useState<PlaceSearchResult[]>([]);
  const [searchResultSort, setSearchResultSort] = useState<SearchResultSort>("accuracy");
  const [searchCurrentLocation, setSearchCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [searchCurrentLocationLocating, setSearchCurrentLocationLocating] = useState(false);
  const [mapCenter, setMapCenter] = useState<LocationCoordinates | null>(null);
  const [searchMapCenter, setSearchMapCenter] = useState<LocationCoordinates | null>(null);
  const [searchMapCenterRequest, setSearchMapCenterRequest] = useState(0);
  const [hasVisibleSearchResult, setHasVisibleSearchResult] = useState(true);
  const [isSearchResultsLoading, setSearchResultsLoading] = useState(false);
  const [isSearchViewportSettling, setSearchViewportSettling] = useState(false);
  const [searchResultsFocusRequest, setSearchResultsFocusRequest] = useState(0);
  const [focusedSearchResult, setFocusedSearchResult] = useState<PlaceSearchResult | null>(null);
  const [focusedSearchResultRequest, setFocusedSearchResultRequest] = useState(0);
  const searchCurrentLocationRequestRef = useRef(0);
  const workspaceRestoredRef = useRef(false);
  const calculatedCurrentLocationRef = useRef<LocationCoordinates | null>(null);
  const routeInputVersionRef = useRef(0);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [focusedSavedPlace, setFocusedSavedPlace] = useState<SavedPlace | null>(null);
  const [focusedSavedPlaceRequest, setFocusedSavedPlaceRequest] = useState(0);
  const [savedPlacesByListId, setSavedPlacesByListId] = useState<Record<string, SavedPlace[]>>({});
  const [saveTarget, setSaveTarget] = useState<SavePlaceInput | null>(null);
  const {
    mobileTab,
    mobileSheetState,
    mobileSheetDragging,
    setMobileTab,
    setMobileSheetState,
    selectMobileTab,
    prepareSearchFocus,
    stepMobileSheet,
    sheetGestureHandlers,
    handlePointerHandlers,
  } = useMobileSheetController();

  const start = places[0];
  const currentLocation = places.find((place) => place.isCurrentLocation) ?? null;
  const currentLocationActive = currentLocation !== null;
  const showSearchResultMarkers = searchQuery !== null && mobileTab === "places" && !listManagerOpen;
  const activeList = member.placeLists.find((list) => list.id === selectedListId) ?? null;
  const savedListPlaces = selectedListId ? savedPlacesByListId[selectedListId] ?? [] : [];
  const mapListPlaces = useMemo(
    () => listManagerOpen && activeList
      ? savedListPlaces.map((place) => ({ ...place, color: activeList.color }))
      : undefined,
    [activeList?.color, activeList?.id, listManagerOpen, savedListPlaces],
  );
  const isWorkspaceLoading = !memberStateReady || (member.authenticated && !workspaceRestored);
  const isPlaceListLoading = Boolean(selectedListId && !Object.prototype.hasOwnProperty.call(savedPlacesByListId, selectedListId));
  const resultReturnToStart = resultSnapshot?.returnToStart ?? returnToStart;
  const resultFixedVisitOrders = resultSnapshot?.fixedVisitOrders ?? fixedVisitOrders;
  const savedListIdsForSaveTarget = useMemo(() => {
    if (!saveTarget) return [];
    return member.placeLists.filter((list) => (savedPlacesByListId[list.id] ?? []).some((place) => place.name === saveTarget.name && Math.abs(place.latitude - saveTarget.latitude) < 0.000001 && Math.abs(place.longitude - saveTarget.longitude) < 0.000001)).map((list) => list.id);
  }, [member.placeLists, saveTarget, savedPlacesByListId]);

  const triggerMobileNavigationHaptic = useCallback(() => {
    navigator.vibrate?.(65);
  }, []);

  const loadMember = useCallback(async () => {
    try {
      const response = await fetch("/api/member/state", { cache: "no-store" });
      if (!response.ok) return;
      const nextMember = await response.json() as MemberState;
      setMember(nextMember);
      if (!nextMember.authenticated) {
        workspaceRestoredRef.current = false;
        setWorkspaceRestored(true);
        return;
      }
      if (workspaceRestoredRef.current) return;
      const guestWorkspace = readGuestWorkspace();
      const workspace = nextMember.workspace ?? guestWorkspace;
      if (workspace) {
        const restoredPlaces = normalizePlaceRoles(workspace.places);
        setPlaces(restoredPlaces);
        setReturnToStart(workspace.returnToStart);
        setFixedVisitOrders(workspace.fixedVisitOrders);
      }
      if (guestWorkspace) window.sessionStorage.removeItem(GUEST_WORKSPACE_KEY);
      workspaceRestoredRef.current = true;
      setWorkspaceRestored(true);
    } catch {
      setWorkspaceRestored(true);
    } finally {
      setMemberStateReady(true);
    }
  }, []);
  useEffect(() => { void loadMember(); }, [loadMember]);

  const persistWorkspace = useCallback(async (workspace: WorkspaceSnapshot) => {
    await fetch("/api/member/workspace", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(workspace),
    });
  }, []);
  useEffect(() => {
    if (!memberStateReady || member.authenticated) return;
    try {
      window.sessionStorage.setItem(GUEST_WORKSPACE_KEY, JSON.stringify({ returnToStart, places, fixedVisitOrders }));
    } catch { /* Storage can be unavailable in private browser contexts. */ }
  }, [memberStateReady, member.authenticated, returnToStart, places, fixedVisitOrders]);
  useEffect(() => {
    if (!memberStateReady || !member.authenticated || !workspaceRestored) return;
    const workspace = { returnToStart, places, fixedVisitOrders };
    const timer = window.setTimeout(() => { void persistWorkspace(workspace); }, 700);
    return () => window.clearTimeout(timer);
  }, [memberStateReady, member.authenticated, workspaceRestored, returnToStart, places, fixedVisitOrders, persistWorkspace]);
  useEffect(() => {
    if (!memberStateReady || !member.authenticated || !workspaceRestored) return;
    const workspace = { returnToStart, places, fixedVisitOrders };
    const flushWorkspace = () => {
      if (document.visibilityState === "hidden") void persistWorkspace(workspace);
    };
    document.addEventListener("visibilitychange", flushWorkspace);
    return () => document.removeEventListener("visibilitychange", flushWorkspace);
  }, [memberStateReady, member.authenticated, workspaceRestored, returnToStart, places, fixedVisitOrders, persistWorkspace]);
  useEffect(() => {
    const next = fixedVisitOrders.flatMap((fixed) => isFixedOrderValid(fixed, places)
      ? [{ ...fixed, visitOrder: places.findIndex((place) => place.id === fixed.placeId) + 1 }]
      : []);

    // 동선 배치가 실제로 변한 경우에만 순서 보장 상태를 갱신한다.
    // 위치 추적과 함께 같은 상태를 다시 설정하면 React의 effect 갱신이
    // 연쇄될 수 있으므로, 동일한 상태에는 setter를 호출하지 않는다.
    if (JSON.stringify(next) !== JSON.stringify(fixedVisitOrders)) {
      setFixedVisitOrders(next);
    }
  }, [places, fixedVisitOrders]);
  useEffect(() => {
    if (!listManagerOpen || !selectedListId || savedPlacesByListId[selectedListId]) return;
    let cancelled = false;
    void fetch(`/api/place-lists/${selectedListId}/places`)
      .then(async (response) => response.ok ? (await response.json() as { places: SavedPlace[] }).places : [])
      .then((listPlaces) => { if (!cancelled) setSavedPlacesByListId((current) => ({ ...current, [selectedListId]: listPlaces })); })
      .catch(() => { if (!cancelled) setSavedPlacesByListId((current) => ({ ...current, [selectedListId]: [] })); });
    return () => { cancelled = true; };
  }, [listManagerOpen, selectedListId, savedPlacesByListId]);
  useEffect(() => {
    if (!saveTarget || !member.authenticated) return;
    const missingListIds = member.placeLists.filter((list) => !Object.prototype.hasOwnProperty.call(savedPlacesByListId, list.id)).map((list) => list.id);
    if (missingListIds.length === 0) return;
    let cancelled = false;
    void Promise.all(missingListIds.map(async (listId) => {
      const response = await fetch(`/api/place-lists/${listId}/places`);
      const places = response.ok ? (await response.json() as { places: SavedPlace[] }).places : [];
      return [listId, places] as const;
    })).then((entries) => {
      if (cancelled) return;
      setSavedPlacesByListId((current) => {
        const next = { ...current };
        for (const [listId, listPlaces] of entries) if (!Object.prototype.hasOwnProperty.call(next, listId)) next[listId] = listPlaces;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [member.authenticated, member.placeLists, saveTarget, savedPlacesByListId]);
  useEffect(() => {
    if (result) return;
    calculatedCurrentLocationRef.current = null;
    setResultSnapshot(null);
    setRouteNeedsRecalculation(false);
  }, [result]);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (window.matchMedia("(max-width: 700px)").matches) closeMobileSheet();
      else if (listManagerOpen) closeListManager();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [listManagerOpen]);
  const mapPlaces = useMemo(() => {
    if (!result) return places;
    const ordered = result.orderedPlaces;
    return ordered.length > 1 && ordered[0].id === ordered.at(-1)?.id ? ordered.slice(0, -1) : ordered;
  }, [places, result]);
  const markRouteStale = useCallback(() => {
    routeInputVersionRef.current += 1;
    if (!result) return;
    setRouteNeedsRecalculation(true);
    setHoveredSegmentIndex(null);
    setSelectedSegmentIndex(null);
  }, [result]);

  const addPlace = useCallback((input: PlaceInput): AddPlaceResult => {
    const isDuplicate = places.some((place) => Math.abs(place.latitude - input.latitude) < 0.000001 && Math.abs(place.longitude - input.longitude) < 0.000001);
    if (isDuplicate) {
      const message = "해당 장소는 이미 방문 장소에 있습니다.";
      notify.info(message);
      return { added: false, message };
    }
    if (places.length >= 15) {
      const message = "방문 장소는 최대 15곳까지 추가할 수 있습니다.";
      notify.info(message);
      return { added: false, message };
    }
    setPlaces((current) => normalizePlaceRoles([...current, { ...input, id: newId(), type: "WAYPOINT", stayDurationMinutes: 0 }]));
    markRouteStale();
    return { added: true };
  }, [places, markRouteStale]);
  const updateCurrentLocation = useCallback((input: PlaceInput) => {
    const calculatedCurrentLocation = calculatedCurrentLocationRef.current;
    if (!calculatedCurrentLocation || distanceInMeters(calculatedCurrentLocation, input) >= CURRENT_LOCATION_RECALCULATE_DISTANCE_METERS) {
      markRouteStale();
    }

    setPlaces((current) => {
      const existing = current.find((place) => place.isCurrentLocation);
      const isAlreadyCurrent = existing
        && existing.name === input.name
        && existing.address === input.address
        && Math.abs(existing.latitude - input.latitude) < 0.000001
        && Math.abs(existing.longitude - input.longitude) < 0.000001
        && existing.stayDurationMinutes === 0;

      // 단발 위치 조회라도 역지오코딩 완료 전후로 같은 좌표가 전달될 수 있다.
      // 변경이 없으면 기존 배열을 유지해 불필요한 렌더링과 저장을 막는다.
      if (isAlreadyCurrent) return current;

      const nextCurrentLocation = {
        ...input,
        id: existing?.id ?? newId(),
        type: "START" as const,
        stayDurationMinutes: 0,
        isCurrentLocation: true,
      };

      return normalizePlaceRoles(existing
        ? current.map((place) => place.isCurrentLocation ? nextCurrentLocation : place)
        : [nextCurrentLocation, ...current]);
    });
  }, [markRouteStale]);

  const handleCurrentLocationTrackingChange = useCallback((locating: boolean) => {
    setCurrentLocationLocating((current) => current === locating ? current : locating);
  }, []);

  const toggleCurrentLocation = useCallback((): boolean => {
    if (currentLocationLocating) return false;
    if (!navigator.geolocation) {
      notify.error("이 브라우저에서는 현재 위치를 지원하지 않습니다.");
      return false;
    }

    if (!places.some((place) => place.isCurrentLocation) && places.length >= 15) {
      notify.info("방문 장소는 최대 15개까지 추가할 수 있습니다.");
      return false;
    }

    setCurrentLocationLocating(true);
    setCurrentLocationRequestId((current) => current + 1);
    return true;
  }, [currentLocationLocating, places]);
  const requestSearchCurrentLocation = useCallback((): boolean => {
    if (searchCurrentLocationLocating) return false;
    if (!navigator.geolocation) {
      notify.error("이 브라우저에서는 현재 위치를 지원하지 않습니다.");
      return false;
    }

    const requestId = ++searchCurrentLocationRequestRef.current;
    setSearchCurrentLocationLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestId !== searchCurrentLocationRequestRef.current) return;
        setSearchCurrentLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setSearchCurrentLocationLocating(false);
      },
      () => {
        if (requestId !== searchCurrentLocationRequestRef.current) return;
        notify.error("위치 권한을 확인해 주세요.");
        setSearchCurrentLocationLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
    );
    return true;
  }, [searchCurrentLocationLocating]);
  const handleSearchSortChange = useCallback((sort: SearchResultSort, center?: LocationCoordinates | null) => {
    setSearchResultSort(sort);
    setSearchResultsLoading(true);
    if (sort === "accuracy") {
      searchCurrentLocationRequestRef.current += 1;
      setSearchCurrentLocation(null);
    }
    if (sort === "map-center-distance") setSearchMapCenter(center ?? mapCenter);
  }, [mapCenter]);
  const handleMapCenterChange = useCallback((nextCenter: LocationCoordinates) => {
    setMapCenter((current) => current
      && Math.abs(current.latitude - nextCenter.latitude) < 0.000001
      && Math.abs(current.longitude - nextCenter.longitude) < 0.000001
      ? current
      : nextCenter);
  }, []);
  const retrySearchNearMapCenter = useCallback(() => {
    if (!mapCenter) return;
    setSearchMapCenter(mapCenter);
    setSearchMapCenterRequest((current) => current + 1);
    setHasVisibleSearchResult(true);
    setSearchResultsLoading(true);
  }, [mapCenter]);
  function reorderPlace(id: string, destinationIndex: number) {
    setPlaces((current) => {
      const sourceIndex = current.findIndex((place) => place.id === id);
      if (sourceIndex < 0) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const insertionIndex = Math.max(0, Math.min(destinationIndex, next.length));

      if (sourceIndex === insertionIndex) return current;
      next.splice(insertionIndex, 0, moved);
      const normalized = normalizePlaceRoles(next);

      setFixedVisitOrders((currentFixedOrders) => currentFixedOrders.flatMap((fixed) => {
        const nextIndex = normalized.findIndex((place) => place.id === fixed.placeId);
        return nextIndex < 0 ? [] : [{ ...fixed, visitOrder: nextIndex + 1 }];
      }));

      return normalized;
    });
    markRouteStale();
  }
  function toggleFixedVisitOrder(placeId: string, visitOrder: number) {
    setFixedVisitOrders((current) => current.some((fixed) => fixed.placeId === placeId) ? current.filter((fixed) => fixed.placeId !== placeId) : [...current.filter((fixed) => fixed.visitOrder !== visitOrder), { placeId, visitOrder }]);
    markRouteStale();
  }
  function setReturn(value: boolean) {
    setReturnToStart(value);
    markRouteStale();
  }
  function removePlace(id: string) { if (places.some((place) => place.id === id && place.isCurrentLocation)) setCurrentLocationLocating(false); setPlaces((current) => normalizePlaceRoles(current.filter((place) => place.id !== id))); markRouteStale(); }
  function setStayDuration(id: string, minutes: number) { setPlaces((current) => current.map((place) => place.id === id && !place.isCurrentLocation ? { ...place, stayDurationMinutes: minutes } : place)); markRouteStale(); }  async function optimize() {
    if (places.length < 2 || !start) return;
    const coordinateKeys = new Set<string>();
    const hasDuplicatePlace = places.some((place) => {
      const key = `${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`;
      if (coordinateKeys.has(key)) return true;
      coordinateKeys.add(key);
      return false;
    });
    if (hasDuplicatePlace) {
      setStatus("IDLE");
      notify.info("동일한 장소는 중복 등록할 수 없습니다.");
      return;
    }
    setHoveredSegmentIndex(null);
    setSelectedSegmentIndex(null);
    const destination = returnToStart ? null : places.at(-1) ?? null;
    const waypoints = returnToStart ? places.slice(1) : places.slice(1, -1);
    const calculationCurrentLocation = start.isCurrentLocation
      ? { latitude: start.latitude, longitude: start.longitude }
      : null;
    const calculationSnapshot: RouteResultSnapshot = {
      returnToStart,
      fixedVisitOrders: fixedVisitOrders.map((fixed) => ({ ...fixed })),
    };
    const calculationInputVersion = routeInputVersionRef.current;
    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("results");
      setMobileSheetState((current) => current === "collapsed" ? "peek" : current);
      hideListManager();
    }
    setStatus("BUILDING_MATRIX");
    try {
      const response = await fetch("/api/routes/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start, waypoints, destination, returnToStart, fixedVisitOrders }) });
      setStatus("OPTIMIZING");
      const body = await response.json() as OptimizationResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "동선 계산에 실패했습니다.");
      setStatus("FETCHING_FINAL_ROUTE");
      setResult(body);
      setResultSnapshot(calculationSnapshot);
      calculatedCurrentLocationRef.current = calculationCurrentLocation;
      setRouteNeedsRecalculation(routeInputVersionRef.current !== calculationInputVersion);
      setStatus("SUCCESS");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "동선 계산에 실패했습니다.";
      if (message.includes("동일한 장소는 중복 등록할 수 없습니다.")) {
        setStatus("IDLE");
        notify.info(message);
      } else {
        notify.error(message);
        setStatus("ERROR");
      }
    }
  }

  function updateCachedPlaces(listId: string, updater: (current: SavedPlace[]) => SavedPlace[]) {
    setSavedPlacesByListId((current) => ({ ...current, [listId]: updater(current[listId] ?? []) }));
  }

  function updateListCount(listId: string, delta: number) {
    setMember((current) => ({ ...current, placeLists: current.placeLists.map((list) => list.id === listId ? { ...list, placeCount: Math.max(0, list.placeCount + delta), updatedAt: new Date().toISOString() } : list) }));
  }

  async function createList(name: string, color: string) {
    const optimisticId = `optimistic-${newId()}`;
    const now = new Date().toISOString();
    const optimisticList: MemberPlaceList = { id: optimisticId, name, color: color as MemberPlaceList["color"], createdAt: now, updatedAt: now, placeCount: 0 };
    setMember((current) => ({ ...current, placeLists: [optimisticList, ...current.placeLists] }));
    const response = await fetch("/api/place-lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, color }) });
    const body = await response.json() as { list?: MemberPlaceList; error?: { message?: string } };
    if (!response.ok || !body.list) {
      setMember((current) => ({ ...current, placeLists: current.placeLists.filter((list) => list.id !== optimisticId) }));
      return notify.error(body.error?.message || "장소 리스트를 만들지 못했습니다.");
    }
    setMember((current) => ({ ...current, placeLists: current.placeLists.map((list) => list.id === optimisticId ? body.list! : list) }));
    setSelectedListId(body.list.id);
  }

  async function updateList(id: string, name: string, color: string) {
    const previous = member.placeLists.find((list) => list.id === id);
    if (!previous) return;
    setMember((current) => ({ ...current, placeLists: current.placeLists.map((list) => list.id === id ? { ...list, name, color: color as MemberPlaceList["color"], updatedAt: new Date().toISOString() } : list) }));
    const response = await fetch(`/api/place-lists/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, color }) });
    if (!response.ok) {
      setMember((current) => ({ ...current, placeLists: current.placeLists.map((list) => list.id === id ? previous : list) }));
      notify.error("장소 리스트를 수정하지 못했습니다.");
    }
  }

  async function deleteList(id: string) {
    const previous = member.placeLists.find((list) => list.id === id);
    const previousPlaces = savedPlacesByListId[id];
    if (!previous) return;
    setMember((current) => ({ ...current, placeLists: current.placeLists.filter((list) => list.id !== id) }));
    setSavedPlacesByListId((current) => { const next = { ...current }; delete next[id]; return next; });
    setSelectedListId((current) => current === id ? null : current);
    const response = await fetch(`/api/place-lists/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMember((current) => ({ ...current, placeLists: [...current.placeLists, previous] }));
      if (previousPlaces) setSavedPlacesByListId((current) => ({ ...current, [id]: previousPlaces }));
      notify.error("장소 리스트를 삭제하지 못했습니다.");
    }
  }

  async function deleteSavedPlace(id: string) {
    if (!activeList) return;
    const listId = activeList.id;
    const removed = (savedPlacesByListId[listId] ?? []).find((place) => place.id === id);
    if (!removed) return;
    updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== id));
    updateListCount(listId, -1);
    const response = await fetch(`/api/place-lists/${listId}/places?placeId=${id}`, { method: "DELETE" });
    if (!response.ok) {
      updateCachedPlaces(listId, (current) => [...current, removed]);
      updateListCount(listId, 1);
      notify.error("저장한 장소를 삭제하지 못했습니다.");
    }
  }

  async function savePlace(selectedListIds: string[], initiallySelectedListIds: string[]) {
    if (!saveTarget) return;
    const target = saveTarget;
    const selectedListIdSet = new Set(selectedListIds);
    const initiallySelectedListIdSet = new Set(initiallySelectedListIds);
    const listIdsToCreate = selectedListIds.filter((listId) => !initiallySelectedListIdSet.has(listId));
    const listIdsToRemove = initiallySelectedListIds.filter((listId) => !selectedListIdSet.has(listId));
    if (listIdsToCreate.length === 0 && listIdsToRemove.length === 0) return;
    setSaveTarget(null);

    const createOutcomes = await Promise.all(listIdsToCreate.map(async (listId) => {
      const optimisticId = `optimistic-${newId()}`;
      const cacheWasLoaded = Object.prototype.hasOwnProperty.call(savedPlacesByListId, listId);
      const optimisticPlace: SavedPlace = { id: optimisticId, placeListId: listId, name: target.name, address: target.address, latitude: target.latitude, longitude: target.longitude, createdAt: new Date().toISOString() };
      if (cacheWasLoaded) updateCachedPlaces(listId, (current) => [...current, optimisticPlace]);
      updateListCount(listId, 1);
      try {
        const response = await fetch(`/api/place-lists/${listId}/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(target) });
        const body = await response.json() as { saved?: { id: string; created: boolean }; error?: { message?: string } };
        if (!response.ok || !body.saved) throw new Error(body.error?.message || "장소를 저장하지 못했습니다.");
        if (!body.saved.created) {
          if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== optimisticId));
          updateListCount(listId, -1);
          return "duplicate";
        }
        if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.map((place) => place.id === optimisticId ? { ...place, id: body.saved!.id } : place));
        return "created";
      } catch (error) {
        if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== optimisticId));
        updateListCount(listId, -1);
        return error instanceof Error ? error.message : "장소를 저장하지 못했습니다.";
      }
    }));

    const removeOutcomes = await Promise.all(listIdsToRemove.map(async (listId) => {
      const savedPlace = (savedPlacesByListId[listId] ?? []).find((place) => place.name === target.name && Math.abs(place.latitude - target.latitude) < 0.000001 && Math.abs(place.longitude - target.longitude) < 0.000001);
      if (!savedPlace) return "저장한 장소를 찾지 못했습니다.";
      updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== savedPlace.id));
      updateListCount(listId, -1);
      try {
        const response = await fetch(`/api/place-lists/${listId}/places?placeId=${savedPlace.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("저장한 장소를 삭제하지 못했습니다.");
        return "removed";
      } catch (error) {
        updateCachedPlaces(listId, (current) => [...current, savedPlace]);
        updateListCount(listId, 1);
        return error instanceof Error ? error.message : "저장한 장소를 삭제하지 못했습니다.";
      }
    }));

    const outcomes = [...createOutcomes, ...removeOutcomes];
    const createdCount = outcomes.filter((outcome) => outcome === "created").length;
    const removedCount = outcomes.filter((outcome) => outcome === "removed").length;
    const duplicateCount = outcomes.filter((outcome) => outcome === "duplicate").length;
    const failure = outcomes.find((outcome) => outcome !== "created" && outcome !== "removed" && outcome !== "duplicate");
    const completedActions = [createdCount > 0 && `${createdCount}개 장소 리스트에 저장`, removedCount > 0 && `${removedCount}개 장소 리스트에서 제거`].filter(Boolean).join("하고 ");
    if (failure) return notify.error(completedActions ? `${completedActions}했지만 일부는 반영하지 못했습니다.` : failure);
    if (completedActions) return notify.success(`${completedActions}했습니다.`);
    if (duplicateCount > 0) notify.info("선택한 장소 리스트에 이미 저장되어 있습니다.");
  }
  function addSavedPlaceToRoute(place: SavedPlace): AddPlaceResult {
    const addResult = addPlace(place);
    if (addResult.added) notify.success("\uBC29\uBB38 \uC7A5\uC18C\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    return addResult;
  }

  function isListPlaceAddedToRoute(place: PlaceInput) {
    return places.some((candidate) => !candidate.isCurrentLocation && Math.abs(candidate.latitude - place.latitude) < 0.000001 && Math.abs(candidate.longitude - place.longitude) < 0.000001);
  }

  function removeListPlaceFromRoute(place: PlaceInput) {
    const routePlace = places.find((candidate) => !candidate.isCurrentLocation && Math.abs(candidate.latitude - place.latitude) < 0.000001 && Math.abs(candidate.longitude - place.longitude) < 0.000001);
    if (!routePlace) return;
    removePlace(routePlace.id);
    notify.info("방문 장소에서 제거되었습니다.");
  }

  function removeSavedPlaceFromRoute(place: SavedPlace) {
    removeListPlaceFromRoute(place);
  }
  function hideListManager() { setListManagerOpen(false); setFocusedSavedPlace(null); }
  function closeListManager() { hideListManager(); setSelectedListId(null); }

  function openListManager() {
    closeSearchResults();
    setListManagerOpen(true);
    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("places");
    }
  }

  function handleSavedPlacesOpen() {
    if (!member.authenticated) {
      notify.info("회원 전용 기능입니다.");
      return;
    }
    openListManager();
  }

  function openSearchResults(query: string) {
    setSearchQuery(query);
    setSearchMapResults([]);
    setSearchResultSort("accuracy");
    searchCurrentLocationRequestRef.current += 1;
    setSearchCurrentLocation(null);
    setSearchCurrentLocationLocating(false);
    setSearchMapCenter(null);
    setHasVisibleSearchResult(true);
    setSearchResultsLoading(true);
    setFocusedSearchResult(null);
    hideListManager();
    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("places");
      setMobileSheetState("peek");
    }
  }

  function closeSearchResults({ preserveMobileSheetHeight = false }: { preserveMobileSheetHeight?: boolean } = {}) {
    setSearchQuery(null);
    setSearchMapResults([]);
    searchCurrentLocationRequestRef.current += 1;
    setSearchCurrentLocation(null);
    setSearchCurrentLocationLocating(false);
    setSearchMapCenter(null);
    setHasVisibleSearchResult(true);
    setSearchResultsLoading(false);
    setFocusedSearchResult(null);
    if (!preserveMobileSheetHeight && window.matchMedia("(max-width: 700px)").matches) setMobileSheetState("peek");
  }

  function isSearchResultAdded(place: PlaceSearchResult) {
    return places.some((candidate) => Math.abs(candidate.latitude - place.latitude) < 0.000001 && Math.abs(candidate.longitude - place.longitude) < 0.000001);
  }

  function focusSearchResult(place: PlaceSearchResult) {
    setFocusedSearchResult(place);
    setFocusedSearchResultRequest((current) => current + 1);
    if (window.matchMedia("(max-width: 700px)").matches) setMobileSheetState("peek");
  }

  function focusSavedPlace(place: SavedPlace) {
    setFocusedSavedPlace(place);
    setFocusedSavedPlaceRequest((current) => current + 1);
    if (window.matchMedia("(max-width: 700px)").matches) setMobileSheetState("peek");
  }

  function closeMobileSheet() {
    setMobileSheetState("collapsed");
    setListManagerOpen(false);
    window.setTimeout(() => document.getElementById("mobile-map-focus")?.focus(), 0);
  }

  function scrollMobileSheetToTop(tab: "places" | "results") {
    if (!window.matchMedia("(max-width: 700px)").matches) return;

    const panel = document.getElementById(tab === "results" ? "mobile-results-panel" : "mobile-places-panel");
    if (!panel) return;

    const scrollToTop = () => {
      const scrollTargets = new Set<HTMLElement>([
        panel,
        ...panel.querySelectorAll<HTMLElement>(
          ".mobile-sheet-content, .place-list-scroll, .saved-place-list, .place-list-cards, .list-editor-screen-form, .search-results-sheet-list",
        ),
      ]);

      scrollTargets.forEach((target) => target.scrollTo({ top: 0, behavior: "smooth" }));
    };

    // Run after the tab change so a previously hidden sheet can reveal its
    // top section even when peek mode has disabled touch scrolling.
    window.requestAnimationFrame(scrollToTop);
  }

  function handleMobileTabSelect(nextTab: "places" | "lists" | "results") {
    if (nextTab === "lists") {
      if (listManagerOpen && mobileTab === "places") {
        setMobileSheetState((current) => current === "peek" ? "expanded" : "peek");
        return;
      }
      openListManager();
      scrollMobileSheetToTop("places");
      return;
    }

    const isChangingSheet = nextTab !== mobileTab || (nextTab === "places" && listManagerOpen);
    selectMobileTab(nextTab);
    hideListManager();
    if (isChangingSheet) scrollMobileSheetToTop(nextTab);
  }

  function resetPlanner() {
    setCurrentLocationLocating(false);
    setPlaces([]);
    setFixedVisitOrders([]);
    setResult(null);
  }

  function clearRouteResult() {
    setHoveredSegmentIndex(null);
    setSelectedSegmentIndex(null);
    setResult(null);
    setResultSnapshot(null);
    setRouteNeedsRecalculation(false);
    setStatus("IDLE");
    calculatedCurrentLocationRef.current = null;
  }

  function handleMapSegmentSelect(index: number) {
    setHoveredSegmentIndex(null);
    setSelectedSegmentIndex((current) => current === index ? null : index);

    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("results");
      setMobileSheetState("peek");
      hideListManager();
    }

    window.requestAnimationFrame(() => {
      const resultPanel = document.getElementById("mobile-results-panel");
      resultPanel?.scrollTo({ top: 0, behavior: "smooth" });
      resultPanel?.querySelector<HTMLElement>(".mobile-sheet-content")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function handleResultSegmentSelect(index: number | null, source: "stop" | "segment" = "segment") {
    setHoveredSegmentIndex(null);
    setSelectedSegmentIndex(index);

    if (index !== null && source === "segment" && window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("results");
      setMobileSheetState("peek");
      hideListManager();
      window.requestAnimationFrame(() => {
        const resultPanel = document.getElementById("mobile-results-panel");
        resultPanel?.scrollTo({ top: 0, behavior: "smooth" });
        resultPanel?.querySelector<HTMLElement>(".mobile-sheet-content")?.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }
  function browseSavedPlaces() {
    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("places");
      setMobileSheetState("peek");
      hideListManager();
    } else {
      closeListManager();
    }
    window.setTimeout(() => document.getElementById("search")?.focus(), 0);
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APPLICATION_JSON_LD).replace(/</g, "\\u003c") }} />
    <main className={`app-shell mobile-tab-${mobileTab} mobile-sheet-${mobileSheetState}${mobileSheetDragging ? " mobile-sheet-dragging" : ""}`}>
      <aside
        id="mobile-places-panel"
        className="planner-panel mobile-sheet-panel"
        {...sheetGestureHandlers}
      >
        <div className="mobile-sheet-chrome">
          <MobileSheetHandle
            expanded={mobileSheetState !== "collapsed"}
            onPointerDown={handlePointerHandlers.onPointerDown}
            onPointerMove={handlePointerHandlers.onPointerMove}
            onPointerUp={handlePointerHandlers.onPointerUp}
            onPointerCancel={handlePointerHandlers.onPointerCancel}
            onStep={stepMobileSheet}
          />
        </div>
        <div className="mobile-sheet-content">
          <header className="planner-header">
          <div className="planner-title-row">
            <div><img className="routefit-logo" src="/icons/logo.png" alt="루트핏 RouteFit" /></div>
            <MemberHeader authConfigured={member.authConfigured} onBeforeLogin={() => undefined} onSessionChange={loadMember} />
          </div>
          <p>실시간 교통정보를 반영해 방문 순서를 계산합니다.</p>
        </header>
        <div key={listManagerOpen ? "saved-places" : "visit-places"} className={`planner-content-page${listManagerOpen ? " planner-content-page-lists map-list-manager" : ""}`}>
        {listManagerOpen ? (
          isWorkspaceLoading ? (
            <SavedPlacesPanel lists={[]} activeList={null} places={[]} routePlaces={places} onBack={closeListManager} onSelect={() => undefined} onCreate={() => undefined} onUpdate={() => undefined} onDeleteList={() => undefined} onDeletePlace={() => undefined} onAddToRoute={() => ({ added: false })} onRemoveFromRoute={() => undefined} onBrowsePlaces={browseSavedPlaces} onInputFocus={prepareSearchFocus} isLoading />
          ) : member.authenticated ? (
            <SavedPlacesPanel
              lists={member.placeLists}
              activeList={activeList}
              places={savedListPlaces}
              routePlaces={places}
              onBack={() => activeList ? setSelectedListId(null) : closeListManager()}
              onSelect={(id) => { setFocusedSavedPlace(null); setSelectedListId(id); }}
              onCreate={(name, color) => void createList(name, color)}
              onUpdate={(id, name, color) => void updateList(id, name, color)}
              onDeleteList={(id) => void deleteList(id)}
              onDeletePlace={(id) => void deleteSavedPlace(id)}
              onAddToRoute={addSavedPlaceToRoute}
              onRemoveFromRoute={removeSavedPlaceFromRoute}
              onBrowsePlaces={browseSavedPlaces}
              onInputFocus={prepareSearchFocus}
              isPlacesLoading={isPlaceListLoading}
              onPlaceSelect={focusSavedPlace}
            />
          ) : (
            <div className="mobile-list-auth-gate" role="status">
              <img src="/icons/sorry.png" alt="" aria-hidden="true" />
              <strong>장소 리스트는 회원 전용입니다.</strong>
              <p>로그인한 뒤 다양한 장소를 관리해 보세요.</p>
            </div>
          )
        ) : <>
        <LocationSearch onAdd={addPlace} onSave={member.authenticated ? setSaveTarget : undefined} onSearchSubmit={openSearchResults} onSearchPointerDown={prepareSearchFocus} onSearchFocus={prepareSearchFocus} onSavedPlacesOpen={handleSavedPlacesOpen} onSearchClear={() => closeSearchResults({ preserveMobileSheetHeight: true })} showClearAction={searchQuery !== null} mobileAction={<button type="button" className="mobile-search-calculate" onClick={optimize} disabled={places.length < 2 || status === "BUILDING_MATRIX"} aria-label="경로 최적화 계산">경로 최적화 계산</button>} />
        {searchQuery ? <SearchResultsSheet query={searchQuery} currentLocation={searchCurrentLocation} mapCenter={mapCenter} mapCenterFilter={searchMapCenter} mapCenterRequestId={searchMapCenterRequest} isCurrentLocationLocating={searchCurrentLocationLocating} isPlaceAdded={isSearchResultAdded} onAdd={addPlace} onSave={member.authenticated ? setSaveTarget : undefined} onResultsChange={setSearchMapResults} onLoadingChange={setSearchResultsLoading} onResultFocus={focusSearchResult} onSearchContextChange={() => { setFocusedSearchResult(null); setSearchMapResults([]); setHasVisibleSearchResult(true); setSearchResultsLoading(true); setSearchResultsFocusRequest((current) => current + 1); }} onSortChange={handleSearchSortChange} onRequestCurrentLocation={requestSearchCurrentLocation} /> : <>
        <PlaceList places={places} returnToStart={returnToStart} fixedVisitOrders={fixedVisitOrders} onFixedVisitOrderChange={toggleFixedVisitOrder} onReturnChange={setReturn} onReset={resetPlanner} onRemove={removePlace} onReorder={reorderPlace} onStayDurationChange={setStayDuration} onSavePlace={member.authenticated ? setSaveTarget : undefined} currentLocationActive={currentLocationActive} currentLocationLocating={currentLocationLocating} onCurrentLocationToggle={toggleCurrentLocation} onSavedPlacesOpen={member.authenticated ? openListManager : undefined} onMobileInputFocus={prepareSearchFocus} mobileSheetExpanded={mobileSheetState === "expanded"} isLoading={isWorkspaceLoading} />
          <div className="planner-footer">
            <div className="route-primary-group">
              <div className="route-calculate-control optimize-action">
                <button className="primary route-calculate-action" onClick={optimize} disabled={places.length < 2 || status === "BUILDING_MATRIX"} aria-label="경로 최적화 계산" title="경로 최적화 계산">경로 최적화 계산</button>
              </div>
            </div>
          </div>
        </>}
        </>}
        </div>
        </div>
      </aside>
      <section id="mobile-map-focus" className="map-panel" tabIndex={-1}>
        <div className="mobile-member-overlay">
          <MemberHeader authConfigured={member.authConfigured} onBeforeLogin={() => undefined} onSessionChange={loadMember} />
        </div>
        <MapView
          places={mapPlaces}
          segments={listManagerOpen && activeList ? [] : result?.segments ?? []}
          returnToStart={result ? resultReturnToStart : returnToStart}
          highlightedSegmentIndex={hoveredSegmentIndex ?? selectedSegmentIndex}
          focusedSegmentIndex={selectedSegmentIndex}
          onSegmentSelect={handleMapSegmentSelect}
          onMapPlaceSelect={addPlace}
          currentLocationActive={currentLocationActive}
          currentLocationRequestId={currentLocationRequestId}
          onCurrentLocationUpdate={updateCurrentLocation}
          onCurrentLocationTrackingChange={handleCurrentLocationTrackingChange}
          onMapError={notify.error}
          listPlaces={mapListPlaces}
          onListPlaceAdd={addPlace}
          onListPlaceRemove={removeListPlaceFromRoute}
          isListPlaceAdded={isListPlaceAddedToRoute}
          focusedPlace={focusedSavedPlace}
          focusedPlaceRequestId={focusedSavedPlaceRequest}
          searchResults={showSearchResultMarkers ? searchMapResults : undefined}
          temporaryCurrentLocation={showSearchResultMarkers && searchResultSort === "current-distance" ? searchCurrentLocation : null}
          searchResultsFocusRequestId={searchResultsFocusRequest}
          onMapCenterChange={handleMapCenterChange}
          onSearchResultsVisibilityChange={setHasVisibleSearchResult}
          onSearchViewportSettlingChange={setSearchViewportSettling}
          searchViewportKey={mobileSheetState}
          isSearchViewportAdjusting={mobileSheetDragging}
          showSearchMapRetry={showSearchResultMarkers && searchResultSort === "map-center-distance" && !isSearchResultsLoading && !isSearchViewportSettling && !hasVisibleSearchResult}
          onSearchMapRetry={retrySearchNearMapCenter}
          focusedSearchResult={focusedSearchResult}
          focusedSearchResultRequestId={focusedSearchResultRequest}
        />

      </section>
      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴" role="tablist">
        <label className="mobile-navigation-tab" role="tab" tabIndex={0} aria-selected={mobileTab === "places" && !listManagerOpen} aria-controls="mobile-places-panel" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleMobileTabSelect("places"); } }}>
          <input className="ios-navigation-haptic-switch" type="checkbox" tabIndex={-1} aria-hidden="true" ref={(node) => node?.setAttribute("switch", "")} onChange={(event) => { triggerMobileNavigationHaptic(); event.currentTarget.checked = false; handleMobileTabSelect("places"); }} />
          <MapPin size={20} aria-hidden="true" /><span>방문 장소</span>
        </label>
        <label className="mobile-navigation-tab" role="tab" tabIndex={0} aria-selected={mobileTab === "places" && listManagerOpen} aria-controls="mobile-places-panel" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleMobileTabSelect("lists"); } }}>
          <input className="ios-navigation-haptic-switch" type="checkbox" tabIndex={-1} aria-hidden="true" ref={(node) => node?.setAttribute("switch", "")} onChange={(event) => { triggerMobileNavigationHaptic(); event.currentTarget.checked = false; handleMobileTabSelect("lists"); }} />
          <List size={20} aria-hidden="true" /><span>장소 리스트</span>
        </label>
        <label className={`mobile-navigation-tab${result ? " has-route-result" : ""}`} role="tab" tabIndex={0} aria-selected={mobileTab === "results"} aria-controls="mobile-results-panel" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleMobileTabSelect("results"); } }}>
          <input className="ios-navigation-haptic-switch" type="checkbox" tabIndex={-1} aria-hidden="true" ref={(node) => node?.setAttribute("switch", "")} onChange={(event) => { triggerMobileNavigationHaptic(); event.currentTarget.checked = false; handleMobileTabSelect("results"); }} />
          <Waypoints size={20} aria-hidden="true" /><span>계산 결과</span>
        </label>
      </nav>
      <aside
        id="mobile-results-panel"
        className="result-panel mobile-sheet-panel"
        {...sheetGestureHandlers}
      >
        <div className="mobile-sheet-chrome">
          <MobileSheetHandle
            expanded={mobileSheetState !== "collapsed"}
            onPointerDown={handlePointerHandlers.onPointerDown}
            onPointerMove={handlePointerHandlers.onPointerMove}
            onPointerUp={handlePointerHandlers.onPointerUp}
            onPointerCancel={handlePointerHandlers.onPointerCancel}
            onStep={stepMobileSheet}
          />
        </div>
        <div className="mobile-sheet-content">
            <RouteSummary result={result} placeCount={places.length} fixedVisitOrders={result ? resultFixedVisitOrders : fixedVisitOrders} isCalculating={["BUILDING_MATRIX", "OPTIMIZING", "FETCHING_FINAL_ROUTE"].includes(status)} isRouteStale={routeNeedsRecalculation} selectedSegmentIndex={selectedSegmentIndex} onSegmentHover={setHoveredSegmentIndex} onSegmentSelect={handleResultSegmentSelect} onClearResult={clearRouteResult} />
        </div>
      </aside>
      <SavePlaceDialog place={saveTarget} lists={member.placeLists} initialSelectedListIds={savedListIdsForSaveTarget} onSave={(selectedListIds, initiallySelectedListIds) => void savePlace(selectedListIds, initiallySelectedListIds)} onClose={() => setSaveTarget(null)} />
    </main>
    </>
  );
}
