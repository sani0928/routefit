"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { List, MapPin, MoveLeft, MoveRight , Waypoints } from "lucide-react";
import { MapView } from "@/components/map/MapView";
import { MemberHeader } from "@/components/member/MemberHeader";
import { SavePlaceDialog } from "@/components/member/SavePlaceDialog";
import { SavedPlacesPanel } from "@/components/member/SavedPlacesPanel";
import { LocationSearch } from "@/components/route-planner/LocationSearch";
import { PlaceList } from "@/components/route-planner/PlaceList";
import { RouteSummary } from "@/components/route-planner/RouteSummary";
import type { MemberPlaceList, MemberState, SavedPlace } from "@/features/member/types";
import type { FixedVisitOrder, OptimizationResponse, Place } from "@/features/route-optimization/types/route.types";
import { ROUTE_OPTIONS, ROUTE_OPTION_META, type RouteOption } from "@/features/route-optimization/route-options";
import { notify } from "@/lib/notify";
import { useMobileSheetController } from "@/hooks/useMobileSheetController";

type Status = "IDLE" | "BUILDING_MATRIX" | "OPTIMIZING" | "FETCHING_FINAL_ROUTE" | "SUCCESS" | "ERROR";
type PlaceInput = Omit<Place, "id" | "type">;
type MobileTab = "places" | "lists" | "results";
type MobileSheetState = "collapsed" | "peek" | "expanded";
type AddPlaceResult = { added: boolean; message?: string };

type LocationCoordinates = Pick<Place, "latitude" | "longitude">;
const CURRENT_LOCATION_RECALCULATE_DISTANCE_METERS = 150;
const EMPTY_MEMBER: MemberState = { authenticated: false, authConfigured: false, placeLists: [] };
const newId = () => crypto.randomUUID();
const GUEST_WORKSPACE_KEY = "routefit-guest-workspace";
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
  const currentLocation = items.find((place) => place.isCurrentLocation);
  const nonCurrentLocations = items.filter((place) => !place.isCurrentLocation);
  const orderedPlaces = currentLocation
    ? [{ ...currentLocation, isCurrentLocation: true, stayDurationMinutes: 0 }, ...nonCurrentLocations]
    : nonCurrentLocations;

  return orderedPlaces.map((place, index) => ({
    ...place,
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

function isFixedOrderValid(fixed: FixedVisitOrder, items: Place[], returnToStart: boolean) {
  const index = items.findIndex((place) => place.id === fixed.placeId);
  return index > 0 && (returnToStart || index < items.length - 1) && fixed.visitOrder >= 2 && fixed.visitOrder <= items.length;
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
  const [routeNeedsRecalculation, setRouteNeedsRecalculation] = useState(false);
  const [status, setStatus] = useState<Status>("IDLE");
  const [routeOption, setRouteOption] = useState<RouteOption>("traoptimal");
  const [routeOptionHint, setRouteOptionHint] = useState<RouteOption | null>(null);
  const [routeOptionDragging, setRouteOptionDragging] = useState(false);
  const routeOptionHoldTimerRef = useRef<number | null>(null);
  const routeOptionHintDismissTimerRef = useRef<number | null>(null);
  const routeOptionLongPressRef = useRef(false);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [member, setMember] = useState<MemberState>(EMPTY_MEMBER);
  const [memberStateReady, setMemberStateReady] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [currentLocationActive, setCurrentLocationActive] = useState(false);
  const [currentLocationLocating, setCurrentLocationLocating] = useState(false);
  const workspaceRestoredRef = useRef(false);
  const calculatedCurrentLocationRef = useRef<LocationCoordinates | null>(null);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [focusedSavedPlace, setFocusedSavedPlace] = useState<SavedPlace | null>(null);
  const [focusedSavedPlaceRequest, setFocusedSavedPlaceRequest] = useState(0);
  const [savedPlacesByListId, setSavedPlacesByListId] = useState<Record<string, SavedPlace[]>>({});
  const [saveTarget, setSaveTarget] = useState<PlaceInput | null>(null);
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
  const selectedRouteOption = ROUTE_OPTION_META[routeOption];

  useEffect(() => () => {
    if (routeOptionHoldTimerRef.current !== null) window.clearTimeout(routeOptionHoldTimerRef.current);
    if (routeOptionHintDismissTimerRef.current !== null) window.clearTimeout(routeOptionHintDismissTimerRef.current);
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
        setCurrentLocationActive(restoredPlaces.some((place) => place.isCurrentLocation));
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
    const next = fixedVisitOrders.flatMap((fixed) => isFixedOrderValid(fixed, places, returnToStart)
      ? [{ ...fixed, visitOrder: places.findIndex((place) => place.id === fixed.placeId) + 1 }]
      : []);

    // 동선 배치가 실제로 변한 경우에만 순서 보장 상태를 갱신한다.
    // 위치 추적과 함께 같은 상태를 다시 설정하면 React의 effect 갱신이
    // 연쇄될 수 있으므로, 동일한 상태에는 setter를 호출하지 않는다.
    if (JSON.stringify(next) !== JSON.stringify(fixedVisitOrders)) {
      setFixedVisitOrders(next);
    }
  }, [places, returnToStart, fixedVisitOrders]);
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
    if (result) return;
    calculatedCurrentLocationRef.current = null;
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
    setResult(null);
    return { added: true };
  }, [places]);
  const updateCurrentLocation = useCallback((input: PlaceInput) => {
    const calculatedCurrentLocation = calculatedCurrentLocationRef.current;
    if (
      calculatedCurrentLocation
      && distanceInMeters(calculatedCurrentLocation, input) >= CURRENT_LOCATION_RECALCULATE_DISTANCE_METERS
    ) {
      setRouteNeedsRecalculation(true);
    }

    setPlaces((current) => {
      const existing = current.find((place) => place.isCurrentLocation);
      const isAlreadyCurrent = existing
        && current[0]?.id === existing.id
        && existing.name === input.name
        && existing.address === input.address
        && Math.abs(existing.latitude - input.latitude) < 0.000001
        && Math.abs(existing.longitude - input.longitude) < 0.000001
        && existing.stayDurationMinutes === 0;

      // watchPosition은 같은 위치를 여러 번 전달할 수 있다. 변경이 없으면
      // 기존 배열을 그대로 반환해 렌더링과 회원 동선 저장을 반복하지 않는다.
      if (isAlreadyCurrent) return current;

      return normalizePlaceRoles([
        {
          ...input,
          id: existing?.id ?? newId(),
          type: "START",
          stayDurationMinutes: 0,
          isCurrentLocation: true,
        },
        ...current.filter((place) => !place.isCurrentLocation),
      ]);
    });
  }, []);

  const handleCurrentLocationTrackingChange = useCallback((locating: boolean) => {
    setCurrentLocationLocating((current) => current === locating ? current : locating);
  }, []);

  const toggleCurrentLocation = useCallback(() => {
    if (currentLocationActive) {
      setCurrentLocationActive(false);
      setCurrentLocationLocating(false);
      setPlaces((current) => normalizePlaceRoles(current.filter((place) => !place.isCurrentLocation)));
      setResult(null);
      return;
    }

    if (!navigator.geolocation) {
      notify.error("이 브라우저에서는 현재 위치를 지원하지 않습니다.");
      return;
    }

    if (!places.some((place) => place.isCurrentLocation) && places.length >= 15) {
      notify.info("방문 장소는 최대 15개까지 추가할 수 있습니다.");
      return;
    }

    setCurrentLocationLocating(true);
    setCurrentLocationActive(true);
  }, [currentLocationActive, places]);
  function reorderPlace(id: string, destinationIndex: number) {
    setPlaces((current) => {
      const sourceIndex = current.findIndex((place) => place.id === id);
      const hasCurrentLocation = current.some((place) => place.isCurrentLocation);
      const hasFixedDestination = !returnToStart;
      const destinationPlaceIndex = current.length - 1;

      // 현재 위치는 항상 출발지이며, 복귀하지 않는 경로의 마지막 장소는 도착지다.
      // 두 역할은 수동 정렬로 변경되지 않도록 드래그 시작과 삽입 단계에서 모두 보호한다.
      if (
        sourceIndex < 0
        || current[sourceIndex]?.isCurrentLocation
        || (hasFixedDestination && sourceIndex === destinationPlaceIndex)
      ) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const minimumInsertionIndex = hasCurrentLocation ? 1 : 0;
      const maximumInsertionIndex = hasFixedDestination ? next.length - 1 : next.length;
      const insertionIndex = Math.max(minimumInsertionIndex, Math.min(destinationIndex, maximumInsertionIndex));

      if (sourceIndex === insertionIndex) return current;
      next.splice(insertionIndex, 0, moved);
      const normalized = normalizePlaceRoles(next);

      setFixedVisitOrders((currentFixedOrders) => currentFixedOrders.flatMap((fixed) => {
        const nextIndex = normalized.findIndex((place) => place.id === fixed.placeId);
        return nextIndex < 0 ? [] : [{ ...fixed, visitOrder: nextIndex + 1 }];
      }));

      return normalized;
    });
    setResult(null);
  }
  function toggleFixedVisitOrder(placeId: string, visitOrder: number) {
    setFixedVisitOrders((current) => current.some((fixed) => fixed.placeId === placeId) ? current.filter((fixed) => fixed.placeId !== placeId) : [...current.filter((fixed) => fixed.visitOrder !== visitOrder), { placeId, visitOrder }]);
    setResult(null);
  }
  function setReturn(value: boolean) {
    setReturnToStart(value);
    if (!value) setPlaces((current) => current.map((place, index) => index === current.length - 1 ? { ...place, stayDurationMinutes: 0 } : place));
    setResult(null);
  }
  function removePlace(id: string) { if (places.some((place) => place.id === id && place.isCurrentLocation)) { setCurrentLocationActive(false); setCurrentLocationLocating(false); } setPlaces((current) => normalizePlaceRoles(current.filter((place) => place.id !== id))); setResult(null); }
  function setStayDuration(id: string, minutes: number) { setPlaces((current) => current.map((place) => place.id === id && !place.isCurrentLocation ? { ...place, stayDurationMinutes: minutes } : place)); setResult(null); }  async function optimize() {
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
    const destination = returnToStart ? null : places.at(-1) ?? null;
    const waypoints = returnToStart ? places.slice(1) : places.slice(1, -1);
    const calculationCurrentLocation = start.isCurrentLocation
      ? { latitude: start.latitude, longitude: start.longitude }
      : null;
    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("results");
      setMobileSheetState((current) => current === "collapsed" ? "peek" : current);
      setListManagerOpen(false);
    }
    setStatus("BUILDING_MATRIX");
    try {
      const response = await fetch("/api/routes/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start, waypoints, destination, returnToStart, fixedVisitOrders, optimizationCriterion: "DURATION", routeOption }) });
      setStatus("OPTIMIZING");
      const body = await response.json() as OptimizationResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "동선 계산에 실패했습니다.");
      setStatus("FETCHING_FINAL_ROUTE");
      setResult(body);
      calculatedCurrentLocationRef.current = calculationCurrentLocation;
      setRouteNeedsRecalculation(false);
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
    if (!previous || !confirm("Delete this list and its saved places?")) return;
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

  async function savePlace(listId: string) {
    if (!saveTarget) return;
    const target = saveTarget;
    const optimisticId = `optimistic-${newId()}`;
    const cacheWasLoaded = Object.prototype.hasOwnProperty.call(savedPlacesByListId, listId);
    const optimisticPlace: SavedPlace = { id: optimisticId, placeListId: listId, name: target.name, address: target.address, latitude: target.latitude, longitude: target.longitude, createdAt: new Date().toISOString() };
    setSaveTarget(null);
    if (cacheWasLoaded) updateCachedPlaces(listId, (current) => [...current, optimisticPlace]);
    updateListCount(listId, 1);
    const response = await fetch(`/api/place-lists/${listId}/places`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(target) });
    const body = await response.json() as { saved?: { id: string; created: boolean }; error?: { message?: string } };
    if (!response.ok || !body.saved) {
      if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== optimisticId));
      updateListCount(listId, -1);
      return notify.error(body.error?.message || "장소를 저장하지 못했습니다.");
    }
    if (!body.saved.created) {
      if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== optimisticId));
      updateListCount(listId, -1);
      notify.info("해당 장소는 이미 장소 리스트에 저장되어 있습니다.");
      return;
    }
    if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.map((place) => place.id === optimisticId ? { ...place, id: body.saved!.id } : place));
  }

  function addSavedPlaceToRoute(place: SavedPlace): AddPlaceResult {
    const addResult = addPlace(place);
    if (addResult.added) notify.success("\uBC29\uBB38 \uC7A5\uC18C\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    return addResult;
  }

  function closeListManager() { setListManagerOpen(false); setSelectedListId(null); setFocusedSavedPlace(null); }

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

  function handleMobileTabSelect(nextTab: "places" | "lists" | "results") {
    selectMobileTab(nextTab);
    setListManagerOpen(nextTab === "lists");
    if (nextTab !== "lists") setFocusedSavedPlace(null);
  }

  function clearRouteOptionHoldTimer() {
    if (routeOptionHoldTimerRef.current !== null) {
      window.clearTimeout(routeOptionHoldTimerRef.current);
      routeOptionHoldTimerRef.current = null;
    }
  }

  function startRouteOptionHint(option: RouteOption) {
    clearRouteOptionHoldTimer();
    if (routeOptionHintDismissTimerRef.current !== null) window.clearTimeout(routeOptionHintDismissTimerRef.current);
    routeOptionLongPressRef.current = false;
    routeOptionHoldTimerRef.current = window.setTimeout(() => {
      routeOptionLongPressRef.current = true;
      setRouteOptionHint(option);
      routeOptionHoldTimerRef.current = null;
    }, 500);
  }

  function finishRouteOptionHint() {
    clearRouteOptionHoldTimer();
    if (!routeOptionLongPressRef.current) return;
    if (routeOptionHintDismissTimerRef.current !== null) window.clearTimeout(routeOptionHintDismissTimerRef.current);
    routeOptionHintDismissTimerRef.current = window.setTimeout(() => {
      setRouteOptionHint(null);
      routeOptionLongPressRef.current = false;
      routeOptionHintDismissTimerRef.current = null;
    }, 2400);
  }

  function selectRouteOption(option: RouteOption) {
    setRouteOption(option);
    setRouteOptionHint(null);
    setResult(null);
  }

  function selectRouteOptionFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const nextOption = ROUTE_OPTIONS[Math.round(ratio * (ROUTE_OPTIONS.length - 1))];
    selectRouteOption(nextOption);
    return nextOption;
  }

  function handleRouteOptionPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setRouteOptionDragging(true);
    startRouteOptionHint(selectRouteOptionFromPointer(event));
  }

  function handleRouteOptionPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    clearRouteOptionHoldTimer();
    setRouteOptionHint(null);
    selectRouteOptionFromPointer(event);
  }

  function handleRouteOptionPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setRouteOptionDragging(false);
    finishRouteOptionHint();
  }

  function handleRouteOptionKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const currentIndex = ROUTE_OPTIONS.indexOf(routeOption);
    const nextIndex = event.key === "ArrowLeft" || event.key === "ArrowDown"
      ? Math.max(0, currentIndex - 1)
      : event.key === "MoveRight " || event.key === "ArrowUp"
        ? Math.min(ROUTE_OPTIONS.length - 1, currentIndex + 1)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? ROUTE_OPTIONS.length - 1
            : null;
    if (nextIndex === null) return;
    event.preventDefault();
    selectRouteOption(ROUTE_OPTIONS[nextIndex]);
  }

  function resetPlanner() {
    setCurrentLocationActive(false);
    setCurrentLocationLocating(false);
    setPlaces([]);
    setFixedVisitOrders([]);
    setResult(null);
    setRouteOptionHint(null);
  }

  function handleMapSegmentSelect(index: number) {
    setHoveredSegmentIndex(null);
    setSelectedSegmentIndex((current) => current === index ? null : index);

    if (window.matchMedia("(max-width: 700px)").matches) {
      setMobileTab("results");
      setMobileSheetState("peek");
      setListManagerOpen(false);
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
      setListManagerOpen(false);
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
      setListManagerOpen(false);
    } else {
      closeListManager();
    }
    window.setTimeout(() => document.getElementById("search")?.focus(), 0);
  }

  return (
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
            <div><img className="routefit-logo" src="/icons/logo.png" alt="RouteFit" /></div>
            <MemberHeader authConfigured={member.authConfigured} onBeforeLogin={() => undefined} onSessionChange={loadMember} />
          </div>
          <p>실시간 교통정보를 반영해 방문 순서를 계산합니다.</p>
        </header>
        <LocationSearch onAdd={addPlace} onSave={member.authenticated ? setSaveTarget : undefined} onSearchPointerDown={prepareSearchFocus} onSearchFocus={prepareSearchFocus} />
        <PlaceList places={places} returnToStart={returnToStart} fixedVisitOrders={fixedVisitOrders} onFixedVisitOrderChange={toggleFixedVisitOrder} onReturnChange={setReturn} onReset={resetPlanner} onRemove={removePlace} onReorder={reorderPlace} onStayDurationChange={setStayDuration} onSavePlace={member.authenticated ? setSaveTarget : undefined} currentLocationActive={currentLocationActive} currentLocationLocating={currentLocationLocating} onCurrentLocationToggle={toggleCurrentLocation} mobileSheetExpanded={mobileSheetState === "expanded"} isLoading={isWorkspaceLoading} />
        <div className="planner-footer">
          <div className="route-primary-group">
            <div className="route-option-control">
              <div
                className={`route-option-toggle route-option-${selectedRouteOption.tone} route-option-index-${ROUTE_OPTIONS.indexOf(routeOption)}${routeOptionDragging ? " is-dragging" : ""}`}
                role="slider"
                tabIndex={0}
                aria-label="경로 성향"
                aria-valuemin={0}
                aria-valuemax={ROUTE_OPTIONS.length - 1}
                aria-valuenow={ROUTE_OPTIONS.indexOf(routeOption)}
                aria-valuetext={selectedRouteOption.label}
                onPointerDown={handleRouteOptionPointerDown}
                onPointerMove={handleRouteOptionPointerMove}
                onPointerUp={handleRouteOptionPointerEnd}
                onPointerCancel={handleRouteOptionPointerEnd}
                onKeyDown={handleRouteOptionKeyDown}
              >
                <span className="route-option-toggle-track" aria-hidden="true">
                  {routeOption !== "trafast" && <MoveLeft />}
                  {routeOption !== "tracomfort" && <MoveRight  />}
                </span>
                <span className="route-option-toggle-handle">{selectedRouteOption.label}</span>
              </div>
              {routeOptionHint && <p className={`route-option-hint route-option-${ROUTE_OPTION_META[routeOptionHint].tone} route-option-index-${ROUTE_OPTIONS.indexOf(routeOptionHint)}`} role="status">{ROUTE_OPTION_META[routeOptionHint].description}</p>}
            </div>
            <div className="route-calculate-control optimize-action">
              <button className={`primary route-calculate-action route-option-${selectedRouteOption.tone}`} onClick={optimize} disabled={places.length < 2 || status === "BUILDING_MATRIX"} aria-label="경로 계산" title="경로 계산">계산</button>
            </div>
          </div>
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
          returnToStart={returnToStart}
          highlightedSegmentIndex={hoveredSegmentIndex ?? selectedSegmentIndex}
          focusedSegmentIndex={selectedSegmentIndex}
          onSegmentSelect={handleMapSegmentSelect}
          onMapPlaceSelect={addPlace}
          currentLocationActive={currentLocationActive}
          onCurrentLocationUpdate={updateCurrentLocation}
          onCurrentLocationTrackingChange={handleCurrentLocationTrackingChange}
          onMapError={notify.error}
          listPlaces={mapListPlaces}
          onListPlaceAdd={addPlace}
          onListManagerToggle={member.authenticated ? () => listManagerOpen ? closeListManager() : setListManagerOpen(true) : undefined}
          isListManagerOpen={listManagerOpen}
          focusedPlace={focusedSavedPlace}
          focusedPlaceRequestId={focusedSavedPlaceRequest}
        />

        {listManagerOpen && (
          <section
            id="mobile-lists-panel"
            className="map-list-manager"
            aria-label="내 장소 관리"
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
              {isWorkspaceLoading ? (
                <SavedPlacesPanel
                  lists={[]}
                  activeList={null}
                  places={[]}
                  routePlaces={places}
                  onBack={closeListManager}
                  onSelect={() => undefined}
                  onCreate={() => undefined}
                  onUpdate={() => undefined}
                  onDeleteList={() => undefined}
                  onDeletePlace={() => undefined}
                  onAddToRoute={() => ({ added: false })}
                  onBrowsePlaces={browseSavedPlaces}
                  isLoading
                />
              ) : member.authenticated ? (
              <SavedPlacesPanel
              lists={member.placeLists}
              activeList={activeList}
              places={savedListPlaces}
              routePlaces={places}
              onBack={() => activeList ? setSelectedListId(null) : closeListManager()}
              onSelect={(id) => {
                setFocusedSavedPlace(null);
                setSelectedListId(id);
              }}
              onCreate={(name, color) => void createList(name, color)}
              onUpdate={(id, name, color) => void updateList(id, name, color)}
              onDeleteList={(id) => void deleteList(id)}
              onDeletePlace={(id) => void deleteSavedPlace(id)}
              onAddToRoute={addSavedPlaceToRoute}
                onBrowsePlaces={browseSavedPlaces}
                isPlacesLoading={isPlaceListLoading}
                onPlaceSelect={focusSavedPlace}
              />
              ) : (
                <div className="mobile-list-auth-gate" role="status">
                  <img src="/icons/sorry.png" alt="" aria-hidden="true" />
                  <strong>장소 리스트는 회원 전용입니다.</strong>
                  <p>로그인한 뒤 저장한 장소를 관리해 보세요.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </section>
      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴" role="tablist">
        <button type="button" role="tab" aria-selected={mobileTab === "places"} aria-controls="mobile-places-panel" onClick={() => handleMobileTabSelect("places")}>
          <MapPin size={20} aria-hidden="true" /><span>방문 장소</span>
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === "lists"} aria-controls="mobile-lists-panel" onClick={() => handleMobileTabSelect("lists")}>
          <List size={20} aria-hidden="true" /><span>장소 리스트</span>
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === "results"} aria-controls="mobile-results-panel" onClick={() => handleMobileTabSelect("results")}>
          <Waypoints size={20} aria-hidden="true" /><span>계산 결과</span>
        </button>
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
            <RouteSummary result={result} routeOption={result?.summary.routeOption ?? routeOption} placeCount={places.length} fixedVisitOrders={fixedVisitOrders} isCalculating={["BUILDING_MATRIX", "OPTIMIZING", "FETCHING_FINAL_ROUTE"].includes(status)} isCurrentLocationStale={routeNeedsRecalculation} selectedSegmentIndex={selectedSegmentIndex} onSegmentHover={setHoveredSegmentIndex} onSegmentSelect={handleResultSegmentSelect} />
        </div>
      </aside>
      <SavePlaceDialog place={saveTarget} lists={member.placeLists} onSave={(listId) => void savePlace(listId)} onClose={() => setSaveTarget(null)} />
    </main>
  );
}