"use client";

import { Check, ChevronLeft, ChevronRight, MapPinPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { LIST_COLORS, type MemberPlaceList, type SavedPlace } from "@/features/member/types";

interface Props {
  lists: MemberPlaceList[];
  activeList: MemberPlaceList | null;
  places: SavedPlace[];
  onBack: () => void;
  onSelect: (id: string) => void;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDeleteList: (id: string) => void;
  onDeletePlace: (id: string) => void;
  onAddToRoute: (place: SavedPlace) => void;
}

type EditorMode = "create" | "edit" | null;
const LISTS_PER_PAGE = 10;

export function SavedPlacesPanel({ lists, activeList, places, onBack, onSelect, onCreate, onUpdate, onDeleteList, onDeletePlace, onAddToRoute }: Props) {
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LIST_COLORS[0]);
  const [listPage, setListPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(lists.length / LISTS_PER_PAGE));
  const pagedLists = useMemo(() => lists.slice(listPage * LISTS_PER_PAGE, (listPage + 1) * LISTS_PER_PAGE), [listPage, lists]);

  useEffect(() => {
    if (!activeList) return;
    setName(activeList.name);
    setColor(activeList.color);
  }, [activeList?.id, activeList?.name, activeList?.color]);

  useEffect(() => setListPage((page) => Math.min(page, totalPages - 1)), [totalPages]);

  function openCreate() {
    setName("");
    setColor(LIST_COLORS[0]);
    setEditorMode("create");
  }

  function openEdit() {
    if (!activeList) return;
    setName(activeList.name);
    setColor(activeList.color);
    setEditorMode("edit");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (editorMode === "create") onCreate(name.trim(), color);
    if (editorMode === "edit" && activeList) onUpdate(activeList.id, name.trim(), color);
    setEditorMode(null);
  }

  if (activeList) {
    return <section className="saved-places-panel place-list-detail">
      <header className="list-detail-header">
        <button className="list-icon-button" type="button" onClick={onBack} aria-label="장소 리스트로 돌아가기"><ChevronLeft size={18} /></button>
        <button className="list-detail-title" type="button" onClick={openEdit} title="리스트 편집"><span style={{ backgroundColor: activeList.color }} /><strong>{activeList.name}</strong></button>
        <button className="list-icon-button" type="button" onClick={openEdit} aria-label="리스트 편집"><Pencil size={16} /></button>
      </header>
      <ol className="saved-place-list">{places.map((place) => <li key={place.id}>
        <div><strong>{place.name}</strong><small>{place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</small></div>
        <div className="saved-place-actions"><button type="button" onClick={() => onAddToRoute(place)} title="방문 장소에 추가" aria-label={`${place.name} 방문 장소에 추가`}><MapPinPlus size={16} /></button><button type="button" onClick={() => onDeletePlace(place.id)} title="저장 장소 삭제" aria-label={`${place.name} 삭제`}><Trash2 size={16} /></button></div>
      </li>)}</ol>
      {places.length === 0 && <p className="list-empty-state">{"검색 결과 또는 방문 장소에서 저장한 장소가 여기에 표시됩니다."}</p>}
      {editorMode === "edit" && <ListEditor mode="edit" name={name} color={color} onNameChange={setName} onColorChange={setColor} onClose={() => setEditorMode(null)} onSubmit={submit} onDelete={() => { onDeleteList(activeList.id); setEditorMode(null); }} />}
    </section>;
  }

  return <section className="saved-places-panel place-list-overview">
    <header className="list-overview-header"><h2>{"장소 리스트"}</h2><div><button className="list-icon-button" type="button" onClick={openCreate} aria-label="새 리스트 추가"><Plus size={18} /></button><button className="list-icon-button" type="button" onClick={onBack} aria-label="리스트 관리 닫기"><X size={18} /></button></div></header>
    <ol className="place-list-cards">{pagedLists.map((list) => <li key={list.id}><button type="button" className="place-list-card" onClick={() => onSelect(list.id)} title={list.name}><span className="list-color-dot" style={{ backgroundColor: list.color }} /><span>{list.name}</span></button></li>)}</ol>
    {lists.length > LISTS_PER_PAGE && <nav className="list-pagination" aria-label="장소 리스트 페이지"><button type="button" onClick={() => setListPage((page) => Math.max(0, page - 1))} disabled={listPage === 0} aria-label="이전 페이지"><ChevronLeft size={16} /></button><span>{`${listPage + 1} / ${totalPages}`}</span><button type="button" onClick={() => setListPage((page) => Math.min(totalPages - 1, page + 1))} disabled={listPage === totalPages - 1} aria-label="다음 페이지"><ChevronRight size={16} /></button></nav>}
    {lists.length === 0 && <p className="list-empty-state">{"+ 버튼으로 첫 장소 리스트를 만들어 보세요."}</p>}
    {editorMode === "create" && <ListEditor mode="create" name={name} color={color} onNameChange={setName} onColorChange={setColor} onClose={() => setEditorMode(null)} onSubmit={submit} />}
  </section>;
}

interface ListEditorProps {
  mode: Exclude<EditorMode, null>;
  name: string;
  color: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onDelete?: () => void;
}

function ListEditor({ mode, name, color, onNameChange, onColorChange, onClose, onSubmit, onDelete }: ListEditorProps) {
  const heading = mode === "create" ? "새 리스트" : "리스트 편집";
  return <div className="list-editor-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="list-editor-dialog" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
      <header><strong>{heading}</strong><button type="button" onClick={onClose} className="list-editor-close" aria-label="닫기"><X size={17} /></button></header>
      <input autoFocus value={name} maxLength={40} onChange={(event) => onNameChange(event.target.value)} placeholder="리스트 이름" aria-label="리스트 이름" />
      <ColorPicker value={color} onChange={onColorChange} />
      <footer>{onDelete ? <button type="button" className="list-editor-delete" onClick={onDelete} aria-label="리스트 삭제" title="리스트 삭제"><Trash2 size={17} /></button> : <span />}<button className="list-editor-confirm" type="submit" aria-label={mode === "create" ? "리스트 추가" : "변경 저장"}><Check size={17} /></button></footer>
    </form>
  </div>;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return <div className="list-color-picker" aria-label="리스트 색상 선택">{LIST_COLORS.map((option) => <button key={option} type="button" className={option === value ? "selected" : ""} style={{ backgroundColor: option }} onClick={() => onChange(option)} aria-label={`${option} 색상`} />)}</div>;
}