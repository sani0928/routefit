"use client";

import { Check, ChevronLeft, ChevronRight, MapPinned, MapPinPlus, MapPinX, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { LIST_COLORS, type MemberPlaceList, type SavedPlace } from "@/features/member/types";
import { notify } from "@/lib/notify";
import { ContentLoading } from "@/components/ui/ContentLoading";

interface Props {
  lists: MemberPlaceList[];
  activeList: MemberPlaceList | null;
  places: SavedPlace[];
  routePlaces: Array<Pick<SavedPlace, "latitude" | "longitude">>;
  onBack: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDeleteList: (id: string) => void;
  onDeletePlace: (id: string) => void;
  onAddToRoute: (place: SavedPlace) => { added: boolean; message?: string };
  onRemoveFromRoute: (place: SavedPlace) => void;
  onBrowsePlaces: () => void;
  onPlaceSelect?: (place: SavedPlace) => void;
  onInputFocus?: () => void;
  isLoading?: boolean;
  isPlacesLoading?: boolean;
}

type EditorMode = "create" | "edit" | null;
const ITEMS_PER_PAGE = 10;
const formatUpdatedDate = (value: string) => `${value.slice(0, 10).replaceAll("-", ".")} \uC5C5\uB370\uC774\uD2B8`;

export function SavedPlacesPanel({ lists, activeList, places, routePlaces, onBack, onSelect, onCreate, onUpdate, onDeleteList, onDeletePlace, onAddToRoute, onRemoveFromRoute, onBrowsePlaces, onPlaceSelect, onInputFocus, isLoading = false, isPlacesLoading = false }: Props) {
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LIST_COLORS[0]);
  const [listPage, setListPage] = useState(0);
  const [placePage, setPlacePage] = useState(0);
  const [placeQuery, setPlaceQuery] = useState("");
  const isPlaceOnRoute = (place: SavedPlace) => routePlaces.some((routePlace) => Math.abs(routePlace.latitude - place.latitude) < 0.000001 && Math.abs(routePlace.longitude - place.longitude) < 0.000001);
  const deleteConfirmationExpiresAtRef = useRef(0);
  const totalListPages = Math.max(1, Math.ceil(lists.length / ITEMS_PER_PAGE));
  const normalizedPlaceQuery = placeQuery.trim().toLocaleLowerCase();
  const filteredPlaces = useMemo(() => places.filter((place) => {
    if (!normalizedPlaceQuery) return true;
    return `${place.name} ${place.address ?? ""}`.toLocaleLowerCase().includes(normalizedPlaceQuery);
  }), [normalizedPlaceQuery, places]);
  const totalPlacePages = Math.max(1, Math.ceil(filteredPlaces.length / ITEMS_PER_PAGE));
  const pagedLists = useMemo(() => lists.slice(listPage * ITEMS_PER_PAGE, (listPage + 1) * ITEMS_PER_PAGE), [listPage, lists]);
  const pagedPlaces = useMemo(() => filteredPlaces.slice(placePage * ITEMS_PER_PAGE, (placePage + 1) * ITEMS_PER_PAGE), [filteredPlaces, placePage]);

  useEffect(() => {
    if (!activeList) return;
    setName(activeList.name);
    setColor(activeList.color);
  }, [activeList?.id, activeList?.name, activeList?.color]);

  useEffect(() => setListPage((page) => Math.min(page, totalListPages - 1)), [totalListPages]);
  useEffect(() => setPlacePage((page) => Math.min(page, totalPlacePages - 1)), [totalPlacePages]);
  useEffect(() => {
    setPlacePage(0);
    setPlaceQuery("");
  }, [activeList?.id]);

  function openCreate() {
    onInputFocus?.();
    setName("");
    setColor(LIST_COLORS[0]);
    setEditorMode("create");
  }

  function openEdit() {
    if (!activeList) return;
    onInputFocus?.();
    setName(activeList.name);
    setColor(activeList.color);
    setEditorMode("edit");
  }

  function prepareSheetForInputFocus() {
    onInputFocus?.();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (editorMode === "create") onCreate(name.trim(), color);
    if (editorMode === "edit" && activeList) onUpdate(activeList.id, name.trim(), color);
    setEditorMode(null);
  }

  function requestListDeletion() {
    if (!activeList) return;
    if (Date.now() >= deleteConfirmationExpiresAtRef.current) {
      deleteConfirmationExpiresAtRef.current = Date.now() + 3_000;
      notify.info("한 번 더 누르면 리스트가 삭제됩니다.");
      return;
    }

    deleteConfirmationExpiresAtRef.current = 0;
    onDeleteList(activeList.id);
    setEditorMode(null);
  }

  if (editorMode) {
    const isCreate = editorMode === "create";
    return <section className="saved-places-panel place-list-editor-screen" style={{ "--list-color": color } as CSSProperties}>
      <header className="list-editor-screen-header">
        <button className="list-icon-button list-editor-back" type="button" onClick={() => setEditorMode(null)} aria-label={isCreate ? "장소 리스트로 돌아가기" : "리스트 상세로 돌아가기"}><ChevronLeft size={20} /></button>
        <div><h2>{isCreate ? "새 장소 리스트" : "리스트 정보 수정"}</h2></div>
        <div className="list-editor-header-actions">
          {!isCreate && activeList && <button className="list-editor-delete-action" type="button" onClick={requestListDeletion}>삭제</button>}
          <button className="list-editor-header-submit" type="submit" form="place-list-editor-form" disabled={!name.trim()}>{isCreate ? "만들기" : "저장"}</button>
        </div>
      </header>
      <form id="place-list-editor-form" className="list-editor-screen-form" onSubmit={submit}>
        <label className="list-editor-name-field">
          <span>리스트 이름</span>
          <div><input autoFocus value={name} maxLength={40} onPointerDown={prepareSheetForInputFocus} onFocus={() => onInputFocus?.()} onChange={(event) => setName(event.target.value)} placeholder="예: 주말 카페" aria-label="리스트 이름" /><small>{name.length} / 40</small></div>
        </label>
        <fieldset className="list-editor-colors">
          <legend>대표 색상</legend>
          <p>지도와 장소 리스트에서 이 색상으로 구분됩니다.</p>
          <div className="list-editor-color-options">
            {LIST_COLORS.map((option) => <button key={option} type="button" className={option === color ? "selected" : ""} style={{ backgroundColor: option }} onClick={() => setColor(option)} aria-label={`${option} 색상 선택`} aria-pressed={option === color}><Check size={16} /></button>)}
          </div>
        </fieldset>
        <div className="list-editor-preview" aria-label="리스트 미리 보기">
          <span className="list-editor-preview-emblem"><MapPinned size={20} aria-hidden="true" /></span>
          <div><span>미리 보기</span><strong>{name.trim() || "장소 리스트 이름"}</strong></div>
        </div>

      </form>
    </section>;
  }

  if (activeList) {
    return <section className="saved-places-panel place-list-detail" style={{ "--list-color": activeList.color } as CSSProperties}>
      <header className="list-detail-header">
        <button className="list-icon-button" type="button" onClick={onBack} aria-label="장소 리스트로 돌아가기"><ChevronLeft size={18} /></button>
        <button className="list-detail-title" type="button" onClick={openEdit} title="리스트 정보 수정"><span className="list-detail-emblem"><MapPinned size={16} aria-hidden="true" /></span><strong>{activeList.name}</strong></button>
        <button className="list-detail-edit-action" type="button" onClick={openEdit}>리스트 수정</button>
      </header>
      <div className="list-detail-context" aria-label={`${activeList.placeCount}곳 저장됨`}><span><b>{activeList.placeCount}</b>곳 저장됨</span><span>지도에 표시 중</span></div>
      {!isPlacesLoading && places.length > 0 && <div className="saved-place-search"><Search size={15} aria-hidden="true" /><input value={placeQuery} onPointerDown={prepareSheetForInputFocus} onFocus={() => onInputFocus?.()} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="저장한 장소 검색" aria-label="저장한 장소 검색" />{placeQuery && <button type="button" onClick={() => setPlaceQuery("")} aria-label="저장한 장소 검색어 지우기"><X size={14} /></button>}</div>}
      {isPlacesLoading && <ContentLoading variant="saved-places" />}
      {!isPlacesLoading && pagedPlaces.length > 0 && <ol className="saved-place-list saved-place-collection">{pagedPlaces.map((place, index) => {
        const isOnRoute = isPlaceOnRoute(place);
        return <li key={place.id}><span className="saved-place-index">{String(placePage * ITEMS_PER_PAGE + index + 1).padStart(2, "0")}</span><button type="button" className="saved-place-focus" onClick={() => onPlaceSelect?.(place)} aria-label={place.name}><strong>{place.name}</strong><small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small></button><div className="saved-place-actions"><button className={`saved-place-add-action${isOnRoute ? " is-on-route" : ""}`} type="button" onClick={(event) => { event.stopPropagation(); if (isOnRoute) onRemoveFromRoute(place); else onAddToRoute(place); }} title={isOnRoute ? "방문 장소 제거" : "방문 장소 추가"} aria-label={`${place.name} ${isOnRoute ? "방문 장소 제거" : "방문 장소 추가"}`}>{isOnRoute ? <><MapPinX size={16} /><span>방문 장소 제거</span></> : <><MapPinPlus size={16} /><span>방문 장소 추가</span></>}</button><button type="button" onClick={(event) => { event.stopPropagation(); onDeletePlace(place.id); }} title="저장한 장소 삭제" aria-label={`${place.name} 삭제`}><Trash2 size={16} /></button></div></li>;
      })}</ol>}
      {!isPlacesLoading && places.length > 0 && pagedPlaces.length === 0 && <p className="list-empty-state search-empty-state">“{placeQuery}”에 맞는 저장한 장소가 없습니다.</p>}
      {!isPlacesLoading && places.length === 0 && <div className="list-empty-state list-empty-action-area"><p>아직 저장한 장소가 없습니다.</p><span>검색 결과의 저장 버튼으로 이 리스트에 장소를 모아보세요.</span><button type="button" onClick={onBrowsePlaces}><Search size={15} />장소 검색하기</button></div>}
      {!isPlacesLoading && filteredPlaces.length > ITEMS_PER_PAGE && <Pagination page={placePage} totalPages={totalPlacePages} ariaLabel="저장한 장소 페이지" onPageChange={setPlacePage} />}
    </section>;
  }

  if (isLoading) return <section className="saved-places-panel place-list-overview"><ContentLoading variant="collections" /></section>;

  return <section className="saved-places-panel place-list-overview">
    <header className="list-overview-header"><div className="list-overview-heading"><h2>장소 리스트</h2><p>나만의 장소 관리 리스트</p></div><div><button className="list-icon-button list-create-button" type="button" onClick={openCreate} aria-label="새 리스트 추가"><Plus size={18} /></button><button className="list-icon-button list-close-button" type="button" onClick={onBack} aria-label="리스트 관리 닫기"><X size={18} /></button></div></header>
    <div className="list-overview-meta"><span><b>{lists.length}</b>개</span></div>
    {pagedLists.length > 0 && <ol className="place-list-cards place-list-collection">{pagedLists.map((list) => <li key={list.id}><button type="button" className="place-list-card" onClick={() => onSelect(list.id)} title={list.name}><span className="list-color-emblem" style={{ backgroundColor: list.color }}><MapPinned size={18} aria-hidden="true" /></span><span className="list-card-copy"><strong>{list.name}</strong><small><b>{list.placeCount}</b>곳 · {formatUpdatedDate(list.updatedAt)}</small></span><ChevronRight className="list-card-arrow" size={18} aria-hidden="true" /></button></li>)}</ol>}
    {lists.length > ITEMS_PER_PAGE && <Pagination page={listPage} totalPages={totalListPages} ariaLabel="장소 리스트 페이지" onPageChange={setListPage} />}
    {lists.length === 0 && <div className="list-empty-state list-empty-action-area"><p>첫 장소 리스트를 만들어 보세요.</p><span>자주 방문하는 장소를 주제별로 정리할 수 있어요.</span><button type="button" onClick={openCreate}><Plus size={15} />첫 리스트 만들기</button></div>}
  </section>;
}

function Pagination({ page, totalPages, ariaLabel, onPageChange }: { page: number; totalPages: number; ariaLabel: string; onPageChange: (page: number) => void }) {
  return <nav className="list-pagination" aria-label={ariaLabel}>
    <button type="button" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} aria-label="이전 페이지"><ChevronLeft size={16} /></button>
    <span>{`${page + 1} / ${totalPages}`}</span>
    <button type="button" onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} aria-label="다음 페이지"><ChevronRight size={16} /></button>
  </nav>;
}
