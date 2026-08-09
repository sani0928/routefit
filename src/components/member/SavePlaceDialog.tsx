"use client";

import { Check, MapPinned, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MemberPlaceList } from "@/features/member/types";
import type { Place } from "@/features/route-optimization/types/route.types";
import { getPlaceCategoryColor, PlaceCategoryIcon } from "@/components/route-planner/PlaceCategoryIcon";

type SavePlaceDialogProps = {
  place: (Omit<Place, "id" | "type"> & { providerId: string; categoryGroupCode?: string }) | null;
  lists: MemberPlaceList[];
  initialSelectedListIds: string[];
  onSave: (selectedListIds: string[], initialSelectedListIds: string[]) => void;
  onClose: () => void;
};

export function SavePlaceDialog({ place, lists, initialSelectedListIds, onSave, onClose }: SavePlaceDialogProps) {
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const initialSelectionKey = initialSelectedListIds.join(",");

  useEffect(() => {
    setSelectedListIds(initialSelectedListIds);
  }, [place]);

  useEffect(() => {
    if (!place || initialSelectedListIds.length === 0) return;
    setSelectedListIds((current) => [...new Set([...current, ...initialSelectedListIds])]);
  }, [initialSelectionKey, place]);

  if (!place) return null;
  const address = place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`;
  const toggleList = (listId: string) => setSelectedListIds((current) => current.includes(listId) ? current.filter((id) => id !== listId) : [...current, listId]);
  const hasChanges = selectedListIds.length !== initialSelectedListIds.length || selectedListIds.some((listId) => !initialSelectedListIds.includes(listId));

  return <div className="save-place-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="save-place-dialog" role="dialog" aria-modal="true" aria-labelledby="save-place-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="save-place-header">
        <div className="save-place-copy">
          <p style={{ color: getPlaceCategoryColor(place.categoryGroupCode) }}>장소 리스트에 저장</p>
          <div className="save-place-target">
            <span className="save-place-emblem save-place-category-emblem" style={{ backgroundColor: getPlaceCategoryColor(place.categoryGroupCode) }} aria-hidden="true"><PlaceCategoryIcon code={place.categoryGroupCode} size={21} color="#fff" /></span>
            <div><strong id="save-place-title">{place.name}</strong><small>{address}</small></div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기"><X size={19} /></button>
      </header>
      <div className="save-list-heading"><span>저장할 리스트</span><small>{selectedListIds.length}개 선택됨</small></div>
      {lists.length > 0 ? <div className="save-list-options" role="group" aria-label="저장할 장소 리스트">
        {lists.map((list) => {
          const selected = selectedListIds.includes(list.id);
          return <button type="button" key={list.id} className={selected ? "selected" : ""} role="checkbox" aria-checked={selected} onClick={() => toggleList(list.id)}>
            <span className="save-list-emblem" style={{ backgroundColor: list.color }} aria-hidden="true"><MapPinned size={17} /></span>
            <span className="save-list-copy"><strong>{list.name}</strong><small>{list.placeCount}곳 저장됨</small></span>
            <span className="save-list-check" aria-hidden="true">{selected && <Check size={17} />}</span>
          </button>;
        })}
      </div> : <div className="save-list-empty"><MapPinned size={18} aria-hidden="true" /><p>저장할 장소 리스트가 없습니다.<small>장소 리스트 탭에서 새 리스트를 만들어 주세요.</small></p></div>}
      <footer className="save-place-footer"><button type="button" disabled={!hasChanges} onClick={() => onSave(selectedListIds, initialSelectedListIds)}>저장</button></footer>
    </section>
  </div>;
}
