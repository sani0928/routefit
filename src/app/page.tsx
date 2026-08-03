"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChartNoAxesCombined, List, MapPin, Settings } from "lucide-react";
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

type Status = "IDLE" | "BUILDING_MATRIX" | "OPTIMIZING" | "FETCHING_FINAL_ROUTE" | "SUCCESS" | "ERROR";
type PlaceInput = Omit<Place, "id" | "type">;
type MobileTab = "places" | "lists" | "results";
type MobileSheetState = "collapsed" | "peek" | "expanded";
type AddPlaceResult = { added: boolean; message?: string };
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

type MobileSheetDrag = {
  startY: number;
  sheetState: MobileSheetState;
  scrollContainer: HTMLElement | null;
  pointerId: number;
  inputSource: "pointer" | "touch";
  fromHandle: boolean;
  claimed: boolean;
};

function findScrollableSheetAncestor(target: EventTarget | null, sheet: HTMLElement) {
  let element = target instanceof HTMLElement ? target : null;
  while (element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) return element;
    if (element === sheet) break;
    element = element.parentElement;
  }
  return null;
}

function isSheetInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button, input, textarea, select, a, [role=button], [contenteditable=true]"));
}
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
  const [status, setStatus] = useState<Status>("IDLE");
  const [routeOption, setRouteOption] = useState<RouteOption>("traoptimal");
  const [routeOptionMenuOpen, setRouteOptionMenuOpen] = useState(false);
  const routeOptionControlRef = useRef<HTMLDivElement>(null);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [member, setMember] = useState<MemberState>(EMPTY_MEMBER);
  const [memberStateReady, setMemberStateReady] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [currentLocationActive, setCurrentLocationActive] = useState(false);
  const [currentLocationLocating, setCurrentLocationLocating] = useState(false);
  const workspaceRestoredRef = useRef(false);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [savedPlacesByListId, setSavedPlacesByListId] = useState<Record<string, SavedPlace[]>>({});
  const [saveTarget, setSaveTarget] = useState<PlaceInput | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("places");
  const [mobileSheetState, setMobileSheetState] = useState<MobileSheetState>("collapsed");
  const mobileSheetDragRef = useRef<MobileSheetDrag | null>(null);
  const start = places[0];
  const activeList = member.placeLists.find((list) => list.id === selectedListId) ?? null;
  const savedListPlaces = selectedListId ? savedPlacesByListId[selectedListId] ?? [] : [];
  const selectedRouteOption = ROUTE_OPTION_META[routeOption];

  useEffect(() => {
    if (!routeOptionMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (routeOptionControlRef.current?.contains(event.target as Node)) return;
      setRouteOptionMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRouteOptionMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [routeOptionMenuOpen]);
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
      const message = "해당 장소는 이미 방문 예정 장소에 있습니다.";
      notify.info(message);
      return { added: false, message };
    }
    if (places.length >= 15) {
      const message = "방문 예정 장소는 최대 15곳까지 추가할 수 있습니다.";
      notify.info(message);
      return { added: false, message };
    }
    setPlaces((current) => normalizePlaceRoles([...current, { ...input, id: newId(), type: "WAYPOINT", stayDurationMinutes: 0 }]));
    setResult(null);
    return { added: true };
  }, [places]);
  const updateCurrentLocation = useCallback((input: PlaceInput) => {
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
    setResult((current) => current ? null : current);

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
      notify.info("방문 예정 장소는 최대 15개까지 추가할 수 있습니다.");
      return;
    }

    setCurrentLocationLocating(true);
    setCurrentLocationActive(true);
  }, [currentLocationActive, places]);
  function reorderPlace(id: string, destinationIndex: number) {
    setPlaces((current) => {
      const sourceIndex = current.findIndex((place) => place.id === id);
      if (sourceIndex < 0 || sourceIndex === destinationIndex || current[sourceIndex]?.isCurrentLocation) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      const insertionIndex = Math.max(0, Math.min(destinationIndex, next.length));
      next.splice(insertionIndex, 0, moved);
      const currentLocationIndex = next.findIndex((place) => place.isCurrentLocation);
      if (currentLocationIndex > 0) { const [currentLocation] = next.splice(currentLocationIndex, 1); next.unshift(currentLocation); }
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
    return addPlace(place);
  }

  function closeListManager() { setListManagerOpen(false); setSelectedListId(null); }

  function closeMobileSheet() {
    setMobileSheetState("collapsed");
    setListManagerOpen(false);
    window.setTimeout(() => document.getElementById("mobile-map-focus")?.focus(), 0);
  }

  function selectMobileTab(nextTab: MobileTab) {
    setMobileTab(nextTab);
    setMobileSheetState((current) => current === "collapsed" ? "peek" : current);
    setListManagerOpen(nextTab === "lists");
  }

  function stepMobileSheet(direction: "up" | "down") {
    setMobileSheetState((current) => {
      if (direction === "up") return current === "collapsed" ? "peek" : "expanded";
      return current === "expanded" ? "peek" : "collapsed";
    });
  }

  function cycleMobileSheet() {
    setMobileSheetState((current) => current === "collapsed" ? "peek" : current === "peek" ? "expanded" : "collapsed");
  }

  function canClaimMobileSheetDrag(drag: MobileSheetDrag, direction: "up" | "down") {
    if (drag.sheetState === "peek" || drag.fromHandle) return true;
    if ((drag.scrollContainer?.scrollTop ?? 0) > 1) return false;
    if (direction === "up") return drag.sheetState !== "expanded";
    return drag.sheetState !== "collapsed";
  }

  function startMobileSheetDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.pointerType === "touch" || !window.matchMedia("(max-width: 700px)").matches) return;
    const fromHandle = event.currentTarget.classList.contains("mobile-sheet-handle");
    if (!fromHandle && mobileSheetState !== "peek" && isSheetInteractiveTarget(event.target)) return;

    mobileSheetDragRef.current = {
      startY: event.clientY,
      sheetState: mobileSheetState,
      scrollContainer: fromHandle ? null : findScrollableSheetAncestor(event.target, event.currentTarget),
      pointerId: event.pointerId,
      inputSource: "pointer",
      fromHandle,
      claimed: false,
    };
  }

  function moveMobileSheetDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = mobileSheetDragRef.current;
    if (!drag || drag.inputSource !== "pointer" || drag.pointerId !== event.pointerId) return;

    const distance = event.clientY - drag.startY;
    if (!drag.claimed && Math.abs(distance) >= 10) {
      const direction = distance < 0 ? "up" : "down";
      if (!canClaimMobileSheetDrag(drag, direction)) return;
      drag.claimed = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.claimed) event.preventDefault();
  }

  function endMobileSheetDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = mobileSheetDragRef.current;
    if (!drag || drag.inputSource !== "pointer" || drag.pointerId !== event.pointerId) return;
    mobileSheetDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    const distance = event.clientY - drag.startY;
    if (!drag.claimed) {
      if (drag.fromHandle && Math.abs(distance) < 18) cycleMobileSheet();
      return;
    }
    if (Math.abs(distance) >= 42) stepMobileSheet(distance < 0 ? "up" : "down");
  }

  function cancelMobileSheetDrag(event?: ReactPointerEvent<HTMLElement>) {
    if (event?.pointerType === "touch") return;
    mobileSheetDragRef.current = null;
  }

  useEffect(() => {
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    const sheets = Array.from(document.querySelectorAll<HTMLElement>(".mobile-sheet-panel, .map-list-manager"));

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const sheet = event.currentTarget as HTMLElement;
      const target = event.target;
      const fromHandle = target instanceof Element && Boolean(target.closest(".mobile-sheet-handle"));
      if (!fromHandle && mobileSheetState !== "peek" && isSheetInteractiveTarget(target)) return;

      const touch = event.touches[0];
      mobileSheetDragRef.current = {
        startY: touch.clientY,
        sheetState: mobileSheetState,
        scrollContainer: fromHandle ? null : findScrollableSheetAncestor(target, sheet),
        pointerId: touch.identifier,
        inputSource: "touch",
        fromHandle,
        claimed: false,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const drag = mobileSheetDragRef.current;
      if (!drag || drag.inputSource !== "touch") return;
      const touch = Array.from(event.touches).find((item) => item.identifier === drag.pointerId);
      if (!touch) return;

      const distance = touch.clientY - drag.startY;
      if (!drag.claimed && Math.abs(distance) >= 10) {
        const direction = distance < 0 ? "up" : "down";
        if (!canClaimMobileSheetDrag(drag, direction)) return;
        drag.claimed = true;
      }
      if (drag.claimed) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      const drag = mobileSheetDragRef.current;
      if (!drag || drag.inputSource !== "touch") return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === drag.pointerId);
      if (!touch) return;
      mobileSheetDragRef.current = null;

      const distance = touch.clientY - drag.startY;
      if (!drag.claimed) {
        if (drag.fromHandle && Math.abs(distance) < 18) cycleMobileSheet();
        return;
      }
      if (Math.abs(distance) >= 42) stepMobileSheet(distance < 0 ? "up" : "down");
    };

    const onTouchCancel = () => {
      if (mobileSheetDragRef.current?.inputSource === "touch") mobileSheetDragRef.current = null;
    };

    sheets.forEach((sheet) => {
      sheet.addEventListener("touchstart", onTouchStart, { passive: true });
      sheet.addEventListener("touchmove", onTouchMove, { passive: false });
      sheet.addEventListener("touchend", onTouchEnd, { passive: true });
      sheet.addEventListener("touchcancel", onTouchCancel, { passive: true });
    });
    return () => sheets.forEach((sheet) => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", onTouchEnd);
      sheet.removeEventListener("touchcancel", onTouchCancel);
    });
  }, [listManagerOpen, mobileSheetState]);
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
    <main className={`app-shell mobile-tab-${mobileTab} mobile-sheet-${mobileSheetState}`}>
      <aside
        id="mobile-places-panel"
        className="planner-panel mobile-sheet-panel"
        onPointerDown={startMobileSheetDrag}
        onPointerMove={moveMobileSheetDrag}
        onPointerUp={endMobileSheetDrag}
        onPointerCancel={cancelMobileSheetDrag}
      >
        <div className="mobile-sheet-chrome">
          <MobileSheetHandle
            expanded={mobileSheetState !== "collapsed"}
            onPointerDown={startMobileSheetDrag}
            onPointerMove={moveMobileSheetDrag}
            onPointerUp={endMobileSheetDrag}
            onPointerCancel={cancelMobileSheetDrag}
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
        <LocationSearch onAdd={addPlace} onSave={member.authenticated ? setSaveTarget : undefined} onSearchFocus={() => { if (window.matchMedia("(max-width: 700px)").matches && mobileSheetState === "peek") setMobileSheetState("expanded"); }} />
        <PlaceList places={places} returnToStart={returnToStart} fixedVisitOrders={fixedVisitOrders} onFixedVisitOrderChange={toggleFixedVisitOrder} onReturnChange={setReturn} onRemove={removePlace} onReorder={reorderPlace} onStayDurationChange={setStayDuration} onSavePlace={member.authenticated ? setSaveTarget : undefined} currentLocationActive={currentLocationActive} currentLocationLocating={currentLocationLocating} onCurrentLocationToggle={toggleCurrentLocation} />
        <div className="planner-footer">
          <button className="secondary" onClick={() => { setCurrentLocationActive(false); setCurrentLocationLocating(false); setPlaces([]); setFixedVisitOrders([]); setResult(null); }}>전체 초기화</button>
          <div className="route-primary-group">
            <div className="optimize-action">
              <button className={`primary route-option-${selectedRouteOption.tone}`} onClick={optimize} disabled={places.length < 2 || status === "BUILDING_MATRIX"}>동선 최적화</button>
            </div>
            <div className="route-option-control" ref={routeOptionControlRef}>
              <button type="button" className={`route-option-settings route-option-${selectedRouteOption.tone}`} aria-label="경로 성향 설정" aria-expanded={routeOptionMenuOpen} onClick={() => setRouteOptionMenuOpen((open) => !open)}>
                <Settings size={18} strokeWidth={2.1} />
              </button>
              {routeOptionMenuOpen && <div className="route-option-popover" role="menu" aria-label="경로 성향 선택">
              <p>경로 성향</p>
              {ROUTE_OPTIONS.map((option) => {
                const meta = ROUTE_OPTION_META[option];
                const selected = option === routeOption;
                return <button key={option} type="button" role="menuitemradio" aria-checked={selected} className={`route-option-item route-option-${meta.tone}${selected ? " selected" : ""}`} onClick={() => { setRouteOption(option); setRouteOptionMenuOpen(false); setResult(null); }}>
                  <span className="route-option-swatch" />
                  <span><strong>{meta.label}</strong><small>{meta.description}</small></span>
                </button>;
              })}
              </div>}
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
          onMapPlaceSelect={addPlace}
          currentLocationActive={currentLocationActive}
          onCurrentLocationUpdate={updateCurrentLocation}
          onCurrentLocationTrackingChange={handleCurrentLocationTrackingChange}
          onMapError={notify.error}          listPlaces={listManagerOpen && activeList ? savedListPlaces.map((place) => ({ ...place, color: activeList.color })) : undefined}
          onListPlaceAdd={addPlace}
          onListManagerToggle={member.authenticated ? () => listManagerOpen ? closeListManager() : setListManagerOpen(true) : undefined}
          isListManagerOpen={listManagerOpen}
        />

        {listManagerOpen && (
          <section
            id="mobile-lists-panel"
            className="map-list-manager"
            aria-label="내 장소 관리"
            onPointerDown={startMobileSheetDrag}
            onPointerMove={moveMobileSheetDrag}
            onPointerUp={endMobileSheetDrag}
            onPointerCancel={cancelMobileSheetDrag}
          >
            <div className="mobile-sheet-chrome">
              <MobileSheetHandle
                expanded={mobileSheetState !== "collapsed"}
                onPointerDown={startMobileSheetDrag}
                onPointerMove={moveMobileSheetDrag}
                onPointerUp={endMobileSheetDrag}
                onPointerCancel={cancelMobileSheetDrag}
                onStep={stepMobileSheet}
              />
            </div>
            <div className="mobile-sheet-content">
              {member.authenticated ? (
              <SavedPlacesPanel
              lists={member.placeLists}
              activeList={activeList}
              places={savedListPlaces}
              onBack={() => activeList ? setSelectedListId(null) : closeListManager()}
              onSelect={setSelectedListId}
              onCreate={(name, color) => void createList(name, color)}
              onUpdate={(id, name, color) => void updateList(id, name, color)}
              onDeleteList={(id) => void deleteList(id)}
              onDeletePlace={(id) => void deleteSavedPlace(id)}
              onAddToRoute={addSavedPlaceToRoute}
                onBrowsePlaces={browseSavedPlaces}
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
        <button type="button" role="tab" aria-selected={mobileTab === "places"} aria-controls="mobile-places-panel" onClick={() => selectMobileTab("places")}>
          <MapPin size={20} aria-hidden="true" /><span>방문 장소</span>
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === "lists"} aria-controls="mobile-lists-panel" onClick={() => selectMobileTab("lists")}>
          <List size={20} aria-hidden="true" /><span>장소 리스트</span>
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === "results"} aria-controls="mobile-results-panel" onClick={() => selectMobileTab("results")}>
          <ChartNoAxesCombined size={20} aria-hidden="true" /><span>계산 결과</span>
        </button>
      </nav>
      <aside
        id="mobile-results-panel"
        className="result-panel mobile-sheet-panel"
        onPointerDown={startMobileSheetDrag}
        onPointerMove={moveMobileSheetDrag}
        onPointerUp={endMobileSheetDrag}
        onPointerCancel={cancelMobileSheetDrag}
      >
        <div className="mobile-sheet-chrome">
          <MobileSheetHandle
            expanded={mobileSheetState !== "collapsed"}
            onPointerDown={startMobileSheetDrag}
            onPointerMove={moveMobileSheetDrag}
            onPointerUp={endMobileSheetDrag}
            onPointerCancel={cancelMobileSheetDrag}
            onStep={stepMobileSheet}
          />
        </div>
        <div className="mobile-sheet-content">
            <RouteSummary result={result} routeOption={result?.summary.routeOption ?? routeOption} placeCount={places.length} fixedVisitOrders={fixedVisitOrders} isCalculating={["BUILDING_MATRIX", "OPTIMIZING", "FETCHING_FINAL_ROUTE"].includes(status)} onSegmentHover={setHoveredSegmentIndex} onSegmentSelect={setSelectedSegmentIndex} />
        </div>
      </aside>
      <SavePlaceDialog place={saveTarget} lists={member.placeLists} onSave={(listId) => void savePlace(listId)} onClose={() => setSaveTarget(null)} />
    </main>
  );
}