import { Check, MapPin, Route, Search, Trash2, Undo2 } from "lucide-react";
import type { GuidePlace, GuideStage } from "./guide-content";

type GuideWorkspaceProps = {
  places: GuidePlace[];
  resultPlaces: GuidePlace[];
  stage: GuideStage;
  routePath: string;
  visitPlaceCount: number;
  routeEstimate: { distanceKm: number; travelMinutes: number };
  suggestedPlaces: readonly GuidePlace[];
  onAddPlace: (place: GuidePlace) => void;
  onRemovePlace: (id: string) => void;
  onCalculate: () => void;
  onResetResult: () => void;
};

function GuideMapPreview({ places, resultPlaces, routePath, withRoute }: Pick<GuideWorkspaceProps, "places" | "resultPlaces" | "routePath"> & { withRoute: boolean }) {
  return <div className="guide-map-preview" aria-hidden="true">
    <div className="guide-map-grid" />
    <span className="guide-map-road road-one" />
    <span className="guide-map-road road-two" />
    {withRoute && <svg className="guide-route-line" viewBox="0 0 100 100" preserveAspectRatio="none"><path d={routePath} fill="none" pathLength="1" /></svg>}
    {places.map((place, index) => <span className="guide-map-pin" style={{ left: `${place.position.x}%`, top: `${place.position.y}%` }} key={place.id}>
      <b>{withRoute ? resultPlaces.findIndex((candidate) => candidate.id === place.id) + 1 : index + 1}</b>
      <i>{place.name}</i>
    </span>)}
  </div>;
}

export function GuideWorkspace({
  places,
  resultPlaces,
  stage,
  routePath,
  visitPlaceCount,
  routeEstimate,
  suggestedPlaces,
  onAddPlace,
  onRemovePlace,
  onCalculate,
  onResetResult,
}: GuideWorkspaceProps) {
  const canCalculate = visitPlaceCount >= 2;

  return <section className="guide-step guide-step-workspace" id="guide-workspace" aria-label="방문 장소 추가와 동선 계산 체험">
    <div className={`guide-workspace${stage === "result" ? " is-result" : ""}`}>
      <GuideMapPreview places={places} resultPlaces={resultPlaces} routePath={routePath} withRoute={stage === "result"} />
      {stage === "result" ? <div className="guide-panel guide-result-panel">
        <div className="guide-result-heading"><span><Check /> 최적화 완료</span><button type="button" onClick={onResetResult}><Undo2 /> 다시 해보기</button></div>
        <div className="guide-result-card"><small>예상 소요 시간</small><strong>{routeEstimate.travelMinutes}분</strong><div><span>총 이동 거리 <b>{routeEstimate.distanceKm.toFixed(1)}km</b></span><span>방문 장소 <b>{visitPlaceCount}곳</b></span></div></div>
        <div className="guide-panel-heading result-title"><div><h2>추천 방문 순서</h2></div></div>
        <ol className="guide-result-order">{resultPlaces.map((place, index) => <li key={place.id}><b>{index + 1}</b><span>{place.name}</span></li>)}</ol>
        <p className="guide-success-note"><Check /> 지도 위에서 경로를 직접 확인해보세요.</p>
        <a className="guide-real-start" href="/">내 장소로 계산 시작하기</a>
      </div> : <div className="guide-panel">
        <div className="guide-panel-chrome"><span className="active" /><span className={stage === "calculating" ? "active" : ""} /><span /></div>
        <div className="guide-panel-heading"><div><h2>방문 장소 추가</h2></div><span>{visitPlaceCount}곳 추가됨</span></div>
        <p className="guide-panel-copy">검색창은 실제 서비스에서 장소를 찾는 위치입니다.<br />추가한 순서대로 방문 장소가 배치됩니다.</p>
        <div className="guide-search" role="img" aria-label="장소, 주소 검색창 예시"><span className="guide-search-placeholder">장소, 주소 검색</span><span className="guide-search-submit"><Search /></span></div>
        <div className="guide-suggestions" aria-label="예시 장소 추가"><span>예시로 추가</span>{suggestedPlaces.filter((place) => !places.some((current) => current.id === place.id)).map((place) => <button type="button" key={place.id} onClick={() => onAddPlace(place)}><MapPin />{place.name}</button>)}</div>
        <ol className="guide-place-list">{places.map((place, index) => <li key={place.id} data-guide-place-id={place.id} className={`guide-place-item${index === 0 ? " is-start" : ""}`}><div className="guide-place-card"><b>{index + 1}</b><span><strong>{place.name}</strong><small>{index === 0 ? "출발 기준 위치" : "방문할 장소"}</small></span>{index > 0 && <button type="button" className="guide-place-delete" onClick={() => onRemovePlace(place.id)} aria-label={`${place.name} 삭제`}><Trash2 /></button>}</div></li>)}</ol>
        {stage === "calculating" ? <div className="guide-calculating" aria-live="polite"><span /><strong>가장 효율적인 경로를 계산하고 있어요</strong></div> : <button className="guide-calculate" type="button" disabled={!canCalculate} onClick={onCalculate}><Route />{canCalculate ? "경로 최적화 계산" : "장소를 2곳 이상 추가해 보세요."}</button>}
      </div>}
    </div>
  </section>;
}

