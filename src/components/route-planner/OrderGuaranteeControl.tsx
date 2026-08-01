"use client";

import { useEffect, useRef, useState } from "react";
import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";

interface Props {
  places: Place[];
  returnToStart: boolean;
  fixedVisitOrders: FixedVisitOrder[];
  onChange: (placeId: string, visitOrder: number) => void;
}

export function OrderGuaranteeControl({ places, returnToStart, fixedVisitOrders, onChange }: Props) {
  const [isOpen, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const fixedPlaceIds = new Set(fixedVisitOrders.map((fixed) => fixed.placeId));
  const displayPlaces = returnToStart && places[0] ? [...places, { ...places[0], id: `${places[0].id}-return`, name: `${places[0].name} (복귀)` }] : places;

  useEffect(() => {
    function closeWhenOutside(event: MouseEvent) {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, []);

  if (places.length < 2) return null;

  return <div className="order-lock-control" ref={controlRef}>
    <button type="button" className={`order-lock-trigger${fixedVisitOrders.length ? " has-fixed" : ""}`} aria-label="방문 순서 보장" aria-expanded={isOpen} onClick={() => setOpen((current) => !current)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
    </button>
    {isOpen && <div className="order-lock-popover" role="dialog" aria-label="방문 순서 보장 설정">
      <p>방문 순서 보장</p>
      <div className="order-lock-numbers">
        {displayPlaces.map((place, index) => {
          const isStart = index === 0;
          const isDestination = index === displayPlaces.length - 1;
          const isLocked = fixedPlaceIds.has(place.id);
          const isDisabled = isStart || isDestination;
          const tooltip = place.name;
          return <button key={place.id} type="button" className={`order-lock-number${isLocked ? " locked" : ""}${isDisabled ? " disabled" : ""}`} disabled={isDisabled} aria-pressed={isLocked} aria-label={tooltip} onClick={() => onChange(place.id, index + 1)}>
            <span>{index + 1}</span><i role="tooltip">{tooltip}</i>
          </button>;
        })}
      </div>
      <small>고정할 순번을 선택하세요.</small>
    </div>}
  </div>;
}