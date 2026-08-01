"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/map/MapView";
import { MemberHeader } from "@/components/member/MemberHeader";
import { SavePlaceDialog } from "@/components/member/SavePlaceDialog";
import { SavedPlacesPanel } from "@/components/member/SavedPlacesPanel";
import { LocationSearch } from "@/components/route-planner/LocationSearch";
import { PlaceList } from "@/components/route-planner/PlaceList";
import { RouteSummary } from "@/components/route-planner/RouteSummary";
import type { MemberPlaceList, MemberState, SavedPlace } from "@/features/member/types";
import type { FixedVisitOrder, OptimizationResponse, Place } from "@/features/route-optimization/types/route.types";

type Status = "IDLE" | "BUILDING_MATRIX" | "OPTIMIZING" | "FETCHING_FINAL_ROUTE" | "SUCCESS" | "ERROR";
type PlaceInput = Omit<Place, "id" | "type">;
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
const normalizePlaceRoles = (items: Place[]) => items.map((place, index) => ({ ...place, type: index === 0 ? "START" as const : "WAYPOINT" as const }));
function isFixedOrderValid(fixed: FixedVisitOrder, items: Place[], returnToStart: boolean) {
  const index = items.findIndex((place) => place.id === fixed.placeId);
  return index > 0 && (returnToStart || index < items.length - 1) && fixed.visitOrder >= 2 && fixed.visitOrder <= items.length;
}

export default function Home() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [returnToStart, setReturnToStart] = useState(true);
  const [fixedVisitOrders, setFixedVisitOrders] = useState<FixedVisitOrder[]>([]);
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [status, setStatus] = useState<Status>("IDLE");
  const [error, setError] = useState("");
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [member, setMember] = useState<MemberState>(EMPTY_MEMBER);
  const [memberStateReady, setMemberStateReady] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const workspaceRestoredRef = useRef(false);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [savedPlacesByListId, setSavedPlacesByListId] = useState<Record<string, SavedPlace[]>>({});
  const [saveTarget, setSaveTarget] = useState<PlaceInput | null>(null);
  const start = places[0];
  const activeList = member.placeLists.find((list) => list.id === selectedListId) ?? null;
  const savedListPlaces = selectedListId ? savedPlacesByListId[selectedListId] ?? [] : [];
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
        setPlaces(normalizePlaceRoles(workspace.places));
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
    setFixedVisitOrders((current) => {
      const next = current.flatMap((fixed) => isFixedOrderValid(fixed, places, returnToStart)
        ? [{ ...fixed, visitOrder: places.findIndex((place) => place.id === fixed.placeId) + 1 }]
        : []);
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [places, returnToStart]);
  useEffect(() => {
    if (!listManagerOpen || !selectedListId || savedPlacesByListId[selectedListId]) return;
    let cancelled = false;
    void fetch(`/api/place-lists/${selectedListId}/places`)
      .then(async (response) => response.ok ? (await response.json() as { places: SavedPlace[] }).places : [])
      .then((listPlaces) => { if (!cancelled) setSavedPlacesByListId((current) => ({ ...current, [selectedListId]: listPlaces })); })
      .catch(() => { if (!cancelled) setSavedPlacesByListId((current) => ({ ...current, [selectedListId]: [] })); });
    return () => { cancelled = true; };
  }, [listManagerOpen, selectedListId, savedPlacesByListId]);
  const mapPlaces = useMemo(() => {
    if (!result) return places;
    const ordered = result.orderedPlaces;
    return ordered.length > 1 && ordered[0].id === ordered.at(-1)?.id ? ordered.slice(0, -1) : ordered;
  }, [places, result]);
  const addPlace = useCallback((input: PlaceInput) => {
    if (places.length >= 15) return setError("방문 장소는 최대 15곳까지 추가할 수 있습니다.");
    setPlaces((current) => normalizePlaceRoles([...current, { ...input, id: newId(), type: "WAYPOINT", stayDurationMinutes: 0 }]));
    setResult(null); setError("");
  }, [places.length]);
  function addCurrentLocationAsStart(input: PlaceInput) {
    if (places.length >= 15) return setError("방문 장소는 최대 15곳까지 추가할 수 있습니다.");
    setPlaces((current) => normalizePlaceRoles([{ ...input, id: newId(), type: "START", stayDurationMinutes: 0 }, ...current]));
    setResult(null);
  }  function reorderPlace(id: string, targetId: string, position: "before" | "after") {
    setPlaces((current) => {
      const from = current.findIndex((place) => place.id === id); const target = current.findIndex((place) => place.id === targetId);
      if (from < 0 || target < 0 || from === target) return current;
      const next = [...current]; const [moved] = next.splice(from, 1); let insertion = position === "before" ? target : target + 1;
      if (from < target) insertion -= 1; next.splice(insertion, 0, moved); return normalizePlaceRoles(next);
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
  function removePlace(id: string) { setPlaces((current) => normalizePlaceRoles(current.filter((place) => place.id !== id))); setResult(null); }
  function setStayDuration(id: string, minutes: number) { setPlaces((current) => current.map((place) => place.id === id ? { ...place, stayDurationMinutes: minutes } : place)); setResult(null); }  async function optimize() {
    if (places.length < 2 || !start) return;
    const destination = returnToStart ? null : places.at(-1) ?? null;
    const waypoints = returnToStart ? places.slice(1) : places.slice(1, -1);
    setError(""); setStatus("BUILDING_MATRIX");
    try {
      const response = await fetch("/api/routes/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ start, waypoints, destination, returnToStart, fixedVisitOrders, optimizationCriterion: "DURATION" }) });
      setStatus("OPTIMIZING");
      const body = await response.json() as OptimizationResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "동선 계산에 실패했습니다.");
      setStatus("FETCHING_FINAL_ROUTE"); setResult(body); setStatus("SUCCESS");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "동선 계산에 실패했습니다."); setStatus("ERROR");
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
      return setError(body.error?.message || "Unable to create the place list.");
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
      setError("Unable to update the place list.");
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
      setError("Unable to delete the place list.");
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
      setError("Unable to delete the saved place.");
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
      return setError(body.error?.message || "Unable to save the place.");
    }
    if (!body.saved.created) {
      if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.filter((place) => place.id !== optimisticId));
      updateListCount(listId, -1);
      return;
    }
    if (cacheWasLoaded) updateCachedPlaces(listId, (current) => current.map((place) => place.id === optimisticId ? { ...place, id: body.saved!.id } : place));
  }

  function closeListManager() { setListManagerOpen(false); setSelectedListId(null); }  return (
    <main className="app-shell">
      <aside className="planner-panel">
        <header className="planner-header">
          <div className="planner-title-row">
            <div><p className="eyebrow">RouteFit</p></div>
            <MemberHeader authConfigured={member.authConfigured} onBeforeLogin={() => undefined} onSessionChange={loadMember} />
          </div>
          <p>실시간 교통정보를 반영해 방문 순서를 계산합니다.</p>
        </header>
        <LocationSearch onAdd={addPlace} onSave={member.authenticated ? setSaveTarget : undefined} />
        <PlaceList places={places} returnToStart={returnToStart} fixedVisitOrders={fixedVisitOrders} onFixedVisitOrderChange={toggleFixedVisitOrder} onReturnChange={setReturn} onRemove={removePlace} onReorder={reorderPlace} onStayDurationChange={setStayDuration} onSavePlace={member.authenticated ? setSaveTarget : undefined} />
        <div className="planner-footer">
          <button className="secondary" onClick={() => { setPlaces([]); setFixedVisitOrders([]); setResult(null); setError(""); }}>전체 초기화</button>
          <button className="primary" onClick={optimize} disabled={places.length < 2 || status === "BUILDING_MATRIX"}>동선 최적화 계산</button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </aside>
      <section className="map-panel">
        <MapView
          places={mapPlaces}
          segments={listManagerOpen && activeList ? [] : result?.segments ?? []}
          returnToStart={returnToStart}
          highlightedSegmentIndex={hoveredSegmentIndex ?? selectedSegmentIndex}
          onMapPlaceSelect={addPlace}
          onCurrentLocationStart={addCurrentLocationAsStart}
          onMapError={setError}          listPlaces={listManagerOpen && activeList ? savedListPlaces.map((place) => ({ ...place, color: activeList.color })) : undefined}
          onListPlaceAdd={addPlace}
          onListManagerToggle={member.authenticated ? () => setListManagerOpen((current) => !current) : undefined}
          isListManagerOpen={listManagerOpen}
        />
        {listManagerOpen && (
          <section className="map-list-manager" aria-label="내 장소 관리">
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
              onAddToRoute={addPlace}
            />
          </section>
        )}
      </section>      <aside className="result-panel">
        <RouteSummary result={result} placeCount={places.length} isCalculating={["BUILDING_MATRIX", "OPTIMIZING", "FETCHING_FINAL_ROUTE"].includes(status)} onSegmentHover={setHoveredSegmentIndex} onSegmentSelect={setSelectedSegmentIndex} />
      </aside>
      <SavePlaceDialog place={saveTarget} lists={member.placeLists} onSave={(listId) => void savePlace(listId)} onClose={() => setSaveTarget(null)} />
    </main>
  );
}