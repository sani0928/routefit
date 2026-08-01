"use client";

import { DragEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookmarkPlus, Lock, LockOpen, Trash2 } from "lucide-react";
import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";

interface Props {
  places: Place[];
  returnToStart: boolean;
  fixedVisitOrders: FixedVisitOrder[];
  onReturnChange: (value: boolean) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, targetId: string, position: "before" | "after") => void;
  onStayDurationChange: (id: string, minutes: number) => void;
  onFixedVisitOrderChange: (placeId: string, visitOrder: number) => void;
  onSavePlace?: (place: Omit<Place, "id" | "type">) => void;
}

type StayEditor = { id: string; top: number; left: number; width: number; height: number; closing: boolean };
type DropTarget = { id: string; position: "before" | "after" };

export function PlaceList({ places, returnToStart, fixedVisitOrders, onReturnChange, onRemove, onReorder, onStayDurationChange, onFixedVisitOrderChange, onSavePlace }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [stayEditor, setStayEditor] = useState<StayEditor | null>(null);
  const [stayDraft, setStayDraft] = useState("0");
  const closeTimerRef = useRef<number | null>(null);
  const placeCardRefs = useRef(new Map<string, HTMLLIElement>());
  const dropTargetRef = useRef<DropTarget | null>(null);
  const didDragRef = useRef(false);
  const placeOrderKey = places.map((place) => place.id).join("|");
  const displayPlaces = returnToStart && places[0] ? [...places, { ...places[0], id: `${places[0].id}-return` }] : places;
  const fixedPlaceIds = new Set(fixedVisitOrders.map((fixed) => fixed.placeId));

  useEffect(() => {
    const close = () => closeStayEditor();
    const panel = document.querySelector(".planner-panel");
    panel?.addEventListener("scroll", close);
    window.addEventListener("resize", close);
    return () => {
      panel?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!stayEditor || stayEditor.closing) return;
    const index = places.findIndex((place) => place.id === stayEditor.id);
    const canKeepEditing = index > 0 && (returnToStart || index < places.length - 1);
    if (!canKeepEditing) { setStayEditor(null); return; }
    const frame = window.requestAnimationFrame(() => {
      const card = placeCardRefs.current.get(stayEditor.id);
      if (!card) { setStayEditor(null); return; }
      const rect = card.getBoundingClientRect();
      setStayEditor((current) => current?.id === stayEditor.id && !current.closing ? { ...current, top: rect.top, left: rect.right - 1, height: rect.height } : current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [placeOrderKey, places.length, returnToStart, stayEditor?.closing, stayEditor?.id]);

  function dropPosition(event: DragEvent<HTMLLIElement>): "before" | "after" {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  function updateDropTarget(next: DropTarget | null) {
    dropTargetRef.current = next;
    setDropTarget((current) => current?.id === next?.id && current?.position === next?.position ? current : next);
  }

  function clearDragState() {
    setDraggedId(null);
    updateDropTarget(null);
    window.setTimeout(() => { didDragRef.current = false; }, 0);
  }

  function closeStayEditor() {
    setStayEditor((current) => {
      if (!current || current.closing) return current;
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => { setStayEditor(null); closeTimerRef.current = null; }, 380);
      return { ...current, closing: true };
    });
  }

  function openStayEditor(place: Place, card: HTMLLIElement) {
    if (stayEditor?.id === place.id && !stayEditor.closing) { closeStayEditor(); return; }
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    const rect = card.getBoundingClientRect();
    setStayDraft(String(place.stayDurationMinutes ?? 0));
    setStayEditor({ id: place.id, top: rect.top, left: rect.right - 1, width: 116, height: rect.height, closing: false });
  }

  function adjustStayDuration(id: string, delta: number) {
    const current = Number(stayDraft);
    const minutes = Number.isFinite(current) ? current : 0;
    const nextMinutes = Math.min(1_440, Math.max(0, Math.round(minutes / 5) * 5 + delta));
    setStayDraft(String(nextMinutes));
    onStayDurationChange(id, nextMinutes);
  }

  return <section className="place-section">
    <div className="section-heading"><h2>방문 장소</h2><span>{places.length}개</span></div>
    <label className="toggle place-return-toggle"><input type="checkbox" checked={returnToStart} onChange={(event) => onReturnChange(event.target.checked)} /> 출발지로 복귀</label>
    {places.length === 0 && <p className="muted">검색 또는 지도 클릭으로 추가하세요.</p>}
    <ol className="place-list">
      {displayPlaces.map((place, index) => {
        const isReturnStop = returnToStart && index === displayPlaces.length - 1;
        const isStart = index === 0;
        const isDestination = isReturnStop || index === displayPlaces.length - 1;
        const badge = isReturnStop ? "1" : String(index + 1);
        const isDraggable = !isReturnStop;
        const canSetStayDuration = !isStart && !isDestination;
        const isOrderLocked = fixedPlaceIds.has(place.id);
        const isStayEditing = stayEditor?.id === place.id;
        const stayDuration = place.stayDurationMinutes ?? 0;
        const insertionClass = dropTarget?.id === place.id ? ` drop-${dropTarget.position}` : "";
        return <li
          key={place.id}
          ref={(node) => { if (node) placeCardRefs.current.set(place.id, node); else placeCardRefs.current.delete(place.id); }}
          className={`place-item ${isDraggable ? "draggable" : "return-stop"} ${draggedId === place.id ? "dragging" : ""} ${isStayEditing ? "editing-stay" : ""}${canSetStayDuration && stayDuration > 0 ? " has-stay-duration" : ""}${insertionClass}`}
          draggable={isDraggable}
          onClick={(event) => {
            if (didDragRef.current || !canSetStayDuration || (event.target as HTMLElement).closest("button, .drag-handle, .stay-editor-flyout")) return;
            openStayEditor(place, event.currentTarget);
          }}
          onDragStart={(event) => {
            if (!isDraggable) return;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", place.id);
            const dragImage = document.createElement("img");
            dragImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
            event.dataTransfer.setDragImage(dragImage, 0, 0);
            didDragRef.current = true;
            updateDropTarget(null);
            setDraggedId(place.id);
          }}
          onDragOver={(event) => {
            if (!isDraggable || !draggedId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            updateDropTarget(draggedId === place.id ? null : { id: place.id, position: dropPosition(event) });
          }}
          onDrop={(event) => {
            event.preventDefault();
            const target = dropTargetRef.current;
            if (draggedId && target && draggedId !== target.id) onReorder(draggedId, target.id, target.position);
            clearDragState();
          }}
          onDragEnd={clearDragState}
        >
          <span className={`drag-handle${isDraggable ? "" : " placeholder"}`} aria-label={isDraggable ? "드래그하여 순서 변경" : undefined} title={isDraggable ? "드래그하여 순서 변경" : undefined}>⠿</span>
          <div className={`place-badge${isStart ? " start" : isDestination ? " destination" : ""}`}>{badge}</div>
          <div className="place-main"><strong>{place.name}</strong><small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small></div>
          {!isReturnStop && <div className="place-actions">{canSetStayDuration && <button type="button" className={`place-order-lock icon-action${isOrderLocked ? " locked" : ""}`} aria-label={isOrderLocked ? `${index + 1}번째 방문 순서 고정 해제` : `${index + 1}번째 방문 순서 고정`} title={isOrderLocked ? "순서 고정 해제" : "현재 순서 고정"} aria-pressed={isOrderLocked} onClick={() => onFixedVisitOrderChange(place.id, index + 1)}>{isOrderLocked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}</button>}{onSavePlace && <button type="button" className="icon-action place-save-action" aria-label={`${place.name} 내 장소에 저장`} title="내 장소에 저장" onClick={() => onSavePlace({ name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, stayDurationMinutes: 0 })}><BookmarkPlus aria-hidden="true" /></button>}<button type="button" className="danger icon-action place-delete-action" aria-label={`${place.name} 삭제`} title="삭제" onClick={() => onRemove(place.id)}><Trash2 aria-hidden="true" /></button></div>}
          {isStayEditing && stayEditor && <div className={`stay-editor-flyout${stayEditor.closing ? " closing" : ""}`} style={{ top: stayEditor.top, left: stayEditor.left, width: stayEditor.width, height: stayEditor.height }}><label>머무는 시간</label><div className="stay-stepper"><button className="stay-step" type="button" aria-label="머무는 시간 5분 줄이기" onClick={() => adjustStayDuration(place.id, -5)}>−</button><output aria-live="polite">{stayDraft}분</output><button className="stay-step" type="button" aria-label="머무는 시간 5분 늘리기" onClick={() => adjustStayDuration(place.id, 5)}>+</button></div></div>}
        </li>;
      })}
    </ol>
  </section>;
}