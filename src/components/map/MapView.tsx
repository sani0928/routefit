"use client";

import { List } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Place, RouteSegment } from "@/features/route-optimization/types/route.types";
import type { SavedPlace } from "@/features/member/types";
import { routeColor } from "@/lib/route-colors";

type MapPlace = Omit<Place, "id" | "type">;
type NearbyCandidate = MapPlace & { distanceMeters: number };
interface Props { places: Place[]; segments: RouteSegment[]; returnToStart: boolean; highlightedSegmentIndex: number | null; onMapPlaceSelect: (place: MapPlace) => void; currentLocationActive: boolean; onCurrentLocationUpdate: (place: MapPlace) => void; onCurrentLocationTrackingChange?: (locating: boolean) => void; onMapError: (message: string) => void; listPlaces?: (SavedPlace & { color: string })[]; onListPlaceAdd?: (place: MapPlace) => void; onListManagerToggle?: () => void; isListManagerOpen?: boolean; }

const CENTER = { latitude: 36.3504, longitude: 127.3845 };

function createPlaceInfoContent(place: MapPlace, onAdd?: () => void) {
  const container = document.createElement("div");
  container.className = "nearby-place-popup map-place-popup";
  const name = document.createElement("strong");
  name.className = "map-place-popup-name";
  name.textContent = place.name;
  const address = document.createElement("p");
  address.className = "map-place-popup-address";
  address.textContent = place.address || `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`;
  container.append(name, address);
  if (onAdd) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "current-location-start";
    addButton.textContent = "방문 예정 장소에 추가";
    addButton.addEventListener("click", onAdd);
    container.append(addButton);
  }
  return container;
}

function createCurrentLocationPopupContent(address?: string) {
  const container = document.createElement("div");
  container.className = "nearby-place-popup map-place-popup current-location-popup";
  const name = document.createElement("strong");
  name.className = "map-place-popup-name";
  name.textContent = "현재 위치";
  const addressLine = document.createElement("p");
  addressLine.className = "map-place-popup-address";
  addressLine.textContent = address ?? "주소 정보를 확인하는 중입니다.";
  const notice = document.createElement("small");
  notice.textContent = "GPS 기반 위치이므로 실제 주소와 다소 차이가 있을 수 있습니다.";
  container.append(name, addressLine, notice);
  return container;
}

export function MapView({ places, segments, returnToStart, highlightedSegmentIndex, onMapPlaceSelect, currentLocationActive, onCurrentLocationUpdate, onCurrentLocationTrackingChange, onMapError, listPlaces, onListPlaceAdd, onListManagerToggle, isListManagerOpen }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const overlays = useRef<naver.maps.OverlayView[]>([]);
  const currentLocationMarkerRef = useRef<naver.maps.Marker | null>(null);
  const currentLocationAddressRef = useRef<string | null>(null);
  const currentLocationCoordinatesRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const currentLocationAddressRequestIdRef = useRef(0);
  const currentLocationWatchIdRef = useRef<number | null>(null);
  const fittedPlacesKeyRef = useRef("");
  const popupRef = useRef<naver.maps.InfoWindow | null>(null);
  const requestIdRef = useRef(0);
  const popupOpenRef = useRef(false);
  const selectRef = useRef(onMapPlaceSelect);
  const currentLocationUpdateRef = useRef(onCurrentLocationUpdate);
  const trackingChangeRef = useRef(onCurrentLocationTrackingChange);
  const errorRef = useRef(onMapError);
  const listAddRef = useRef(onListPlaceAdd);
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const [mapInitialized, setMapInitialized] = useState(false);

  const updateCurrentLocationPlace = useCallback((latitude: number, longitude: number, address?: string | null) => {
    currentLocationUpdateRef.current({
      name: "현재 위치",
      address: address ?? currentLocationAddressRef.current ?? "현재 위치",
      latitude,
      longitude,
      stayDurationMinutes: 0,
      isCurrentLocation: true,
    });
  }, []);

  const resolveCurrentLocationAddress = useCallback(async (latitude: number, longitude: number) => {
    const requestId = ++currentLocationAddressRequestIdRef.current;

    try {
      const response = await fetch(`/api/maps/reverse-geocode?lat=${latitude}&lng=${longitude}`);
      const body = await response.json() as { address?: string };
      if (requestId !== currentLocationAddressRequestIdRef.current) return;

      const currentCoordinates = currentLocationCoordinatesRef.current;
      if (!currentCoordinates || Math.abs(currentCoordinates.latitude - latitude) > 0.000001 || Math.abs(currentCoordinates.longitude - longitude) > 0.000001) return;

      currentLocationAddressRef.current = response.ok && body.address && body.address !== "주소 정보 없음"
        ? body.address
        : "주소 정보를 찾지 못했습니다.";
    } catch {
      if (requestId !== currentLocationAddressRequestIdRef.current) return;
      currentLocationAddressRef.current = "주소 정보를 찾지 못했습니다.";
    }

    updateCurrentLocationPlace(latitude, longitude, currentLocationAddressRef.current);
    if (popupOpenRef.current) popupRef.current?.setContent(createCurrentLocationPopupContent(currentLocationAddressRef.current));
  }, [updateCurrentLocationPlace]);

  const renderCurrentLocationMarker = useCallback((latitude: number, longitude: number) => {
    const activeMap = mapRef.current;
    if (!activeMap || !window.naver) return;

    const previousCoordinates = currentLocationCoordinatesRef.current;
    const coordinatesChanged = !previousCoordinates
      || Math.abs(previousCoordinates.latitude - latitude) > 0.000001
      || Math.abs(previousCoordinates.longitude - longitude) > 0.000001;
    const position = new window.naver.maps.LatLng(latitude, longitude);

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setPosition(position);
    } else {
      const marker = new window.naver.maps.Marker({
        position,
        map: activeMap,
        title: "현재 위치",
        icon: { content: '<div class="current-location-marker"><span></span></div>', anchor: new window.naver.maps.Point(11, 11) },
      });

      window.naver.maps.Event.addListener(marker, "click", () => {
        const coordinates = currentLocationCoordinatesRef.current;
        const map = mapRef.current;
        if (!coordinates || !map) return;

        const markerPosition = new window.naver.maps.LatLng(coordinates.latitude, coordinates.longitude);
        popupRef.current?.setContent(createCurrentLocationPopupContent(currentLocationAddressRef.current ?? undefined));
        popupRef.current?.setPosition(markerPosition);
        popupRef.current?.open(map, markerPosition);
        popupOpenRef.current = true;
        if (!currentLocationAddressRef.current) void resolveCurrentLocationAddress(coordinates.latitude, coordinates.longitude);
      });
      currentLocationMarkerRef.current = marker;
    }

    currentLocationCoordinatesRef.current = { latitude, longitude };
    if (coordinatesChanged) {
      currentLocationAddressRef.current = null;
      if (popupOpenRef.current) popupRef.current?.setContent(createCurrentLocationPopupContent());
    }

    updateCurrentLocationPlace(latitude, longitude);
    if (coordinatesChanged || !currentLocationAddressRef.current) void resolveCurrentLocationAddress(latitude, longitude);

    if (!previousCoordinates) {
      activeMap.setCenter(position);
      if (activeMap.getZoom() < 15) activeMap.setZoom(15);
    }
  }, [resolveCurrentLocationAddress, updateCurrentLocationPlace]);
  useEffect(() => {
    selectRef.current = onMapPlaceSelect;
    currentLocationUpdateRef.current = onCurrentLocationUpdate;
    trackingChangeRef.current = onCurrentLocationTrackingChange;
    errorRef.current = onMapError;
    listAddRef.current = onListPlaceAdd;
  }, [onMapPlaceSelect, onCurrentLocationUpdate, onCurrentLocationTrackingChange, onMapError, onListPlaceAdd]);

  useEffect(() => {
    if (!mapInitialized) return;

    if (!currentLocationActive) {
      if (currentLocationWatchIdRef.current !== null) navigator.geolocation?.clearWatch(currentLocationWatchIdRef.current);
      currentLocationWatchIdRef.current = null;
      currentLocationMarkerRef.current?.setMap(null);
      currentLocationMarkerRef.current = null;
      currentLocationAddressRef.current = null;
      currentLocationCoordinatesRef.current = null;
      popupRef.current?.close();
      trackingChangeRef.current?.(false);
      return;
    }

    if (!navigator.geolocation) {
      errorRef.current("이 브라우저에서는 현재 위치를 지원하지 않습니다.");
      trackingChangeRef.current?.(false);
      return;
    }

    trackingChangeRef.current?.(true);
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        renderCurrentLocationMarker(coords.latitude, coords.longitude);
        trackingChangeRef.current?.(false);
      },
      () => {
        errorRef.current("현재 위치를 가져오지 못했습니다. 위치 권한을 확인해 주세요.");
        trackingChangeRef.current?.(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
    );
    currentLocationWatchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (currentLocationWatchIdRef.current === watchId) currentLocationWatchIdRef.current = null;
      trackingChangeRef.current?.(false);
    };
  }, [currentLocationActive, mapInitialized, renderCurrentLocationMarker]);  useEffect(() => {
    if (!clientId || !nodeRef.current || mapRef.current) return;
    const createPopupContent = (candidates?: NearbyCandidate[], addressFallback?: MapPlace) => {
      const container = document.createElement("div");
      container.className = "nearby-place-popup";
      if (!candidates) { container.innerHTML = '<div class="nearby-place-loading"><span></span>주변 장소를 찾는 중/div>'; return container; }
      if (candidates.length === 0 && !addressFallback) { container.innerHTML = '<p class="nearby-place-empty">이 위치의 주소를 찾지 못했습니다.</p>'; return container; }
      const title = document.createElement("p"); title.className = "nearby-place-title"; title.textContent = "이 위치를 추가할까요?"; container.appendChild(title);
      candidates.forEach((candidate) => {
        const button = document.createElement("button"); button.type = "button"; button.className = "nearby-place-option";
        const name = document.createElement("strong"); name.textContent = candidate.name;
        const distance = document.createElement("span"); distance.textContent = `${candidate.distanceMeters}m`;
        button.append(name, distance);
        button.addEventListener("click", () => { selectRef.current(candidate); popupRef.current?.close(); popupOpenRef.current = false; });
        container.appendChild(button);
      });
      if (addressFallback) {
        const button = document.createElement("button"); button.type = "button"; button.className = "nearby-place-option nearby-address-option";
        const name = document.createElement("strong"); name.textContent = addressFallback.address || addressFallback.name;
        button.appendChild(name);
        button.addEventListener("click", () => { selectRef.current(addressFallback); popupRef.current?.close(); popupOpenRef.current = false; });
        container.appendChild(button);
      }
      return container;
    };
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let syncMapSize: (() => void) | null = null;
    const init = () => {
      if (!nodeRef.current || !window.naver) return;
      const map = new window.naver.maps.Map(nodeRef.current, { center: new window.naver.maps.LatLng(CENTER.latitude, CENTER.longitude), zoom: 12, zoomControl: false });
      mapRef.current = map;
    setMapInitialized(true);
      syncMapSize = () => {
        if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          const rect = viewRef.current?.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) return;
          map.setSize({ width: rect.width, height: rect.height });
          resizeFrame = null;
        });
      };
      resizeObserver = new ResizeObserver(syncMapSize);
      // NAVER SDK가 nodeRef의 인라인 크기를 직접 변경하므로, 안정적인 상위 뷰를 관찰한다.
      resizeObserver.observe(viewRef.current ?? nodeRef.current);
      window.addEventListener("resize", syncMapSize);
      syncMapSize();
      popupRef.current = new window.naver.maps.InfoWindow({ content: createPopupContent([]), maxWidth: 260, backgroundColor: "transparent", borderWidth: 0, disableAnchor: true, disableAutoPan: true, pixelOffset: new window.naver.maps.Point(0, -12), zIndex: 100 });
      window.naver.maps.Event.addListener(map, "click", async (event: naver.maps.PointerEvent) => {
        if (popupOpenRef.current) { requestIdRef.current += 1; popupRef.current?.close(); popupOpenRef.current = false; return; }
        const coordinate = event.coord as naver.maps.LatLng; const latitude = coordinate.lat(); const longitude = coordinate.lng(); const requestId = ++requestIdRef.current;
        errorRef.current(""); popupRef.current?.setContent(createPopupContent()); popupRef.current?.setPosition(coordinate); popupRef.current?.open(map, coordinate); popupOpenRef.current = true;
        try {
          const response = await fetch(`/api/places/nearby?lat=${latitude}&lng=${longitude}`);
          const body = await response.json() as { results?: NearbyCandidate[]; error?: { message?: string } };
          if (requestId !== requestIdRef.current) return;
          if (!response.ok) throw new Error(body.error?.message || "주변 장소를 찾지 못했습니다.");
          const candidates = body.results ?? [];
          let addressFallback: MapPlace | undefined;
          try {
            const reverseResponse = await fetch(`/api/maps/reverse-geocode?lat=${latitude}&lng=${longitude}`);
            const reverseBody = await reverseResponse.json() as { address?: string };
            if (requestId !== requestIdRef.current) return;
            if (reverseResponse.ok && reverseBody.address && reverseBody.address !== "주소 정보 없음") {
              addressFallback = { name: reverseBody.address, address: reverseBody.address, latitude, longitude };
            }
          } catch { /* 주소 선택지는 생략하고 장소 후보를 계속 제공합니다. */ }
          popupRef.current?.setContent(createPopupContent(candidates, addressFallback));
        } catch (reason) {
          if (requestId !== requestIdRef.current) return;
          popupRef.current?.close(); popupOpenRef.current = false; errorRef.current(reason instanceof Error ? reason.message : "주변 장소를 찾지 못했습니다.");
        }
      });
    };
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.async = true; script.onload = init; document.head.appendChild(script);
    return () => { resizeObserver?.disconnect(); if (syncMapSize) window.removeEventListener("resize", syncMapSize); if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame); script.remove(); popupRef.current?.close(); currentLocationMarkerRef.current?.setMap(null); currentLocationMarkerRef.current = null; popupRef.current = null; popupOpenRef.current = false; setMapInitialized(false); mapRef.current = null; };
  }, [clientId]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !window.naver) return;
    overlays.current.forEach((overlay) => overlay.setMap(null)); overlays.current = [];
    const markerPlaces = listPlaces ?? places.filter((place) => !place.isCurrentLocation);
    const first = markerPlaces[0] ?? { latitude: CENTER.latitude, longitude: CENTER.longitude };
    const initial = new window.naver.maps.LatLng(first.latitude, first.longitude);
    const bounds = new window.naver.maps.LatLngBounds(initial, initial);
    const isOptimized = !listPlaces && segments.length > 0;
    markerPlaces.forEach((place, index) => {
      const position = new window.naver.maps.LatLng(place.latitude, place.longitude); bounds.extend(position);
      const isStart = index === 0;
      const isDestination = !returnToStart && index === markerPlaces.length - 1;
      const roleClass = isStart ? "start" : isDestination ? "destination" : "waypoint";
      const label = String(index + 1 + (!listPlaces && places.some((place) => place.isCurrentLocation) ? 1 : 0));
      const listColor = listPlaces?.[index]?.color;
      const markerStyle = isOptimized ? ` style="--marker-color:${routeColor(index)}"` : listColor ? ` style="--marker-color:${listColor}"` : "";
      const markerClass = isOptimized || listColor ? "optimized" : roleClass;
      const marker = new window.naver.maps.Marker({ position, map, title: place.name, icon: { content: `<div class="map-marker ${markerClass}"${markerStyle}>${label}</div>`, anchor: new window.naver.maps.Point(16, 16) } });
      window.naver.maps.Event.addListener(marker, "click", () => {
        requestIdRef.current += 1;
        popupRef.current?.setContent(createPlaceInfoContent(place, listColor ? () => listAddRef.current?.({ name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude }) : undefined));
        popupRef.current?.setPosition(position);
        popupRef.current?.open(map, position);
        popupOpenRef.current = true;
      });
      overlays.current.push(marker);
    });
    if (!listPlaces) segments.forEach((segment, index) => {
      if (segment.path.length < 2) return;
      const path = segment.path.map(([longitude, latitude]) => new window.naver.maps.LatLng(latitude, longitude));
      const color = routeColor(index);
      const isHighlighted = highlightedSegmentIndex === index;
      const isDimmed = highlightedSegmentIndex !== null && !isHighlighted;
      if (isHighlighted) {
        const outerGlow = new window.naver.maps.Polyline({ map, path, strokeColor: color, strokeWeight: 18, strokeOpacity: 0.12 });
        const innerGlow = new window.naver.maps.Polyline({ map, path, strokeColor: color, strokeWeight: 11, strokeOpacity: 0.28 });
        overlays.current.push(outerGlow, innerGlow);
      }
      const polyline = new window.naver.maps.Polyline({ map, path, strokeColor: color, strokeWeight: isHighlighted ? 6 : 5, strokeOpacity: isDimmed ? 0.28 : 0.9 });
      overlays.current.push(polyline);
    });
    const placesKey = markerPlaces.map((place) => `${place.id}:${place.latitude}:${place.longitude}`).join("|");
    if (markerPlaces.length > 1 && fittedPlacesKeyRef.current !== placesKey) {
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      fittedPlacesKeyRef.current = placesKey;
    }
  }, [places, segments, highlightedSegmentIndex, listPlaces]);

  if (!clientId) {
    return (
      <div className="map-placeholder">
        <div>
          <strong>{"지도 설정이 필요합니다."}</strong>
          <p>{"NEXT_PUBLIC_NAVER_MAP_CLIENT_ID를 추가하면 지도가 표시됩니다."}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={viewRef} className="map-view">
      <div ref={nodeRef} className="map-canvas" aria-label={"NAVER 지도"} />
      {onListManagerToggle && (
        <button
          type="button"
          className={`map-list-control${isListManagerOpen ? " active" : ""}`}
          aria-label={"장소 리스트 관리"}
          aria-pressed={isListManagerOpen}
          onClick={onListManagerToggle}
        >
          <List size={18} aria-hidden="true" />
        </button>
      )}
      <div className="map-zoom-control" aria-label={"지도 확대 및 축소"}>
        <button type="button" aria-label={"지도 확대"} onClick={() => mapRef.current?.setZoom(mapRef.current.getZoom() + 1)}>
          +
        </button>
        <span aria-hidden="true" />
        <button type="button" aria-label={"지도 축소"} onClick={() => mapRef.current?.setZoom(mapRef.current.getZoom() - 1)}>
          −
        </button>
      </div>
    </div>
  );
}
