"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Place, RouteSegment } from "@/features/route-optimization/types/route.types";
import type { SavedPlace } from "@/features/member/types";
import type { PlaceSearchResult } from "@/features/place-search/types";
import { getMobileSheetStageHeights } from "@/lib/mobile-sheet";
import { routeColor } from "@/lib/route-colors";

type MapPlace = Omit<Place, "id" | "type">;
type NearbyCandidate = MapPlace & { distanceMeters: number };
type MapFocusPlace = Pick<MapPlace, "latitude" | "longitude">;
interface Props { places: Place[]; segments: RouteSegment[]; returnToStart: boolean; highlightedSegmentIndex: number | null; focusedSegmentIndex?: number | null; focusedPlace?: MapFocusPlace | null; focusedPlaceRequestId?: number; searchResults?: PlaceSearchResult[]; focusedSearchResult?: MapFocusPlace | null; focusedSearchResultRequestId?: number; onSegmentSelect?: (index: number) => void; onMapPlaceSelect: (place: MapPlace) => void; currentLocationActive: boolean; currentLocationRequestId?: number; onCurrentLocationUpdate: (place: MapPlace) => void; onCurrentLocationTrackingChange?: (locating: boolean) => void; onMapError: (message: string) => void; listPlaces?: (SavedPlace & { color: string })[]; onListPlaceAdd?: (place: MapPlace) => void; }

const CENTER = { latitude: 36.3504, longitude: 127.3845 };
const MOBILE_SHEET_SETTLE_DURATION_MS = 380;

function getMobileMapInsets(mapNode: HTMLElement | null, preferredSheetId?: string) {
  const mapRect = mapNode?.getBoundingClientRect();
  if (!mapRect) return { top: 34, right: 30, bottom: 32, left: 30, coveredHeight: 0 };

  const candidates = [
    preferredSheetId ? document.getElementById(preferredSheetId) : null,
    document.getElementById("mobile-places-panel"),
    document.getElementById("mobile-lists-panel"),
    document.getElementById("mobile-results-panel"),
    document.querySelector<HTMLElement>(".mobile-bottom-nav"),
  ].filter((element): element is HTMLElement => Boolean(element));

  const coveredHeight = candidates.reduce((maximum, element) => {
    const rect = element.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom > mapRect.top && rect.top < mapRect.bottom;
    if (!isVisible) return maximum;
    return Math.max(maximum, Math.max(0, Math.min(mapRect.height, mapRect.bottom - Math.max(mapRect.top, rect.top))));
  }, 0);

  return {
    top: 34,
    right: 30,
    bottom: Math.max(32, Math.round(coveredHeight) + 28),
    left: 30,
    coveredHeight,
  };
}

function getMobilePeekMapInsets(mapNode: HTMLElement | null) {
  const mapRect = mapNode?.getBoundingClientRect();
  if (!mapRect) return { top: 34, right: 30, bottom: 32, left: 30, coveredHeight: 0 };

  const layoutViewportHeight = Number.parseFloat(document.documentElement.style.getPropertyValue("--mobile-layout-viewport-height")) || window.innerHeight;
  const navigationHeight = document.querySelector<HTMLElement>(".mobile-bottom-nav")?.getBoundingClientRect().height ?? 64;
  const { peek } = getMobileSheetStageHeights(layoutViewportHeight, navigationHeight);
  const coveredHeight = Math.min(mapRect.height, Math.round(peek + navigationHeight));

  return {
    top: 34,
    right: 30,
    bottom: Math.max(32, coveredHeight + 28),
    left: 30,
    coveredHeight,
  };
}

type MapMargin = { top: number; right: number; bottom: number; left: number };

function getFocusMargin(margin: MapMargin): MapMargin {
  return {
    top: margin.top + 20,
    right: margin.right + 20,
    bottom: margin.bottom + 56,
    left: margin.left + 20,
  };
}

function getPathFocusTarget(map: naver.maps.Map, path: [number, number][], margin: MapMargin, fixedZoom?: number) {
  const size = map.getSize();
  const visibleWidth = Math.max(1, size.width - margin.left - margin.right);
  const visibleHeight = Math.max(1, size.height - margin.top - margin.bottom);
  const projection = map.getProjection();
  const points = path.map(([longitude, latitude]) => projection.fromCoordToPoint(new window.naver.maps.LatLng(latitude, longitude)));
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const minZoom = Math.ceil(map.getMinZoom());
  const maxZoom = Math.floor(map.getMaxZoom());
  let zoom = fixedZoom ?? minZoom;

  if (fixedZoom === undefined) {
    for (let candidate = maxZoom; candidate >= minZoom; candidate -= 1) {
      const factor = projection.factor(candidate);
      if ((maxX - minX) * factor <= visibleWidth && (maxY - minY) * factor <= visibleHeight) {
        zoom = candidate;
        break;
      }
    }
  }

  const factor = projection.factor(zoom);
  const desiredX = margin.left + (visibleWidth / 2);
  const desiredY = margin.top + (visibleHeight / 2);
  const centerPoint = new window.naver.maps.Point(
    (minX + maxX) / 2 + ((size.width / 2) - desiredX) / factor,
    (minY + maxY) / 2 + ((size.height / 2) - desiredY) / factor,
  );

  return { center: projection.fromPointToCoord(centerPoint), zoom };
}
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
    addButton.textContent = "방문 장소에 추가";
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

export function MapView({ places, segments, returnToStart, highlightedSegmentIndex, focusedSegmentIndex, focusedPlace, focusedPlaceRequestId, searchResults, focusedSearchResult, focusedSearchResultRequestId, onSegmentSelect, onMapPlaceSelect, currentLocationActive, currentLocationRequestId, onCurrentLocationUpdate, onCurrentLocationTrackingChange, onMapError, listPlaces, onListPlaceAdd }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const overlays = useRef<naver.maps.OverlayView[]>([]);
  const currentLocationMarkerRef = useRef<naver.maps.Marker | null>(null);
  const currentLocationAddressRef = useRef<string | null>(null);
  const currentLocationCoordinatesRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const currentLocationAddressRequestIdRef = useRef(0);
  const fittedPlacesKeyRef = useRef("");
  const popupRef = useRef<naver.maps.InfoWindow | null>(null);
  const requestIdRef = useRef(0);
  const popupOpenRef = useRef(false);
  const selectRef = useRef(onMapPlaceSelect);
  const segmentSelectRef = useRef(onSegmentSelect);
  const currentLocationUpdateRef = useRef(onCurrentLocationUpdate);
  const trackingChangeRef = useRef(onCurrentLocationTrackingChange);
  const errorRef = useRef(onMapError);
  const listAddRef = useRef(onListPlaceAdd);
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const [mapInitialized, setMapInitialized] = useState(false);
  const zoomBy = useCallback((amount: number) => {
    const map = mapRef.current;
    if (!map || !window.naver) return;

    const targetZoom = Math.max(
      Math.ceil(map.getMinZoom()),
      Math.min(Math.floor(map.getMaxZoom()), map.getZoom() + amount),
    );
    if (targetZoom === map.getZoom()) return;

    map.morph(map.getCenter(), targetZoom, { duration: 260, easing: "easeOutCubic" } as naver.maps.TransitionOptions);
  }, []);

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

    const targetZoom = Math.max(activeMap.getZoom(), 15);
    const transition = { duration: 260, easing: "easeOutCubic" } as naver.maps.TransitionOptions;

    if (window.matchMedia("(max-width: 700px)").matches) {
      // Match saved-list single-place focus: calculate against the fixed peek
      // coverage before moving, so the marker lands in the visible map centre.
      const target = getPathFocusTarget(
        activeMap,
        [[longitude, latitude]],
        getFocusMargin(getMobilePeekMapInsets(nodeRef.current)),
        targetZoom,
      );
      if (activeMap.getZoom() === target.zoom) activeMap.panTo(target.center, transition);
      else activeMap.morph(target.center, target.zoom, transition);
      return;
    }

    activeMap.morph(position, targetZoom, transition);
  }, [resolveCurrentLocationAddress, updateCurrentLocationPlace]);
  useEffect(() => {
    selectRef.current = onMapPlaceSelect;
    segmentSelectRef.current = onSegmentSelect;
    currentLocationUpdateRef.current = onCurrentLocationUpdate;
    trackingChangeRef.current = onCurrentLocationTrackingChange;
    errorRef.current = onMapError;
    listAddRef.current = onListPlaceAdd;
  }, [onMapPlaceSelect, onSegmentSelect, onCurrentLocationUpdate, onCurrentLocationTrackingChange, onMapError, onListPlaceAdd]);

  useEffect(() => {
    if (!mapInitialized || currentLocationActive) return;
    currentLocationMarkerRef.current?.setMap(null);
    currentLocationMarkerRef.current = null;
    currentLocationAddressRef.current = null;
    currentLocationCoordinatesRef.current = null;
    popupRef.current?.close();
  }, [currentLocationActive, mapInitialized]);

  useEffect(() => {
    if (!mapInitialized || !currentLocationRequestId) return;
    if (!navigator.geolocation) {
      errorRef.current("브라우저에서 현재 위치를 지원하지 않습니다.");
      trackingChangeRef.current?.(false);
      return;
    }

    trackingChangeRef.current?.(true);
    navigator.geolocation.getCurrentPosition(
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
  }, [currentLocationRequestId, mapInitialized, renderCurrentLocationMarker]);  useEffect(() => {
    if (!clientId || !nodeRef.current || mapRef.current) return;
    const createPopupContent = (candidates?: NearbyCandidate[], addressFallback?: MapPlace) => {
      const container = document.createElement("div");
      container.className = "nearby-place-popup";
      if (!candidates) { container.innerHTML = '<div class="nearby-place-loading"><span></span>주변 장소를 찾는 중</div>'; return container; }
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
      const map = new window.naver.maps.Map(nodeRef.current, { center: new window.naver.maps.LatLng(CENTER.latitude, CENTER.longitude), zoom: window.matchMedia("(max-width: 700px)").matches ? 13 : 12, zoomControl: false });
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
      let longPressTimer: number | null = null;
      let longPressTriggered = false;
      const cancelLongPress = () => {
        if (longPressTimer !== null) window.clearTimeout(longPressTimer);
        longPressTimer = null;
      };
      const findNearbyAt = async (coordinate: naver.maps.LatLng) => {
        const latitude = coordinate.lat();
        const longitude = coordinate.lng();
        const requestId = ++requestIdRef.current;
        popupRef.current?.setContent(createPopupContent());
        popupRef.current?.setPosition(coordinate);
        popupRef.current?.open(map, coordinate);
        popupOpenRef.current = true;
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
          } catch { /* 주소 선택지는 생략하고 주변 장소 후보를 계속 제공합니다. */ }
          popupRef.current?.setContent(createPopupContent(candidates, addressFallback));
        } catch (reason) {
          if (requestId !== requestIdRef.current) return;
          popupRef.current?.close();
          popupOpenRef.current = false;
          errorRef.current(reason instanceof Error ? reason.message : "주변 장소를 찾지 못했습니다.");
        }
      };
      const beginLongPress = (event: naver.maps.PointerEvent) => {
        cancelLongPress();
        longPressTriggered = false;
        const coordinate = event.coord as naver.maps.LatLng;
        longPressTimer = window.setTimeout(() => {
          longPressTimer = null;
          longPressTriggered = true;
          void findNearbyAt(coordinate);
        }, 550);
      };
      const cancelOnGesture = () => cancelLongPress();
      window.naver.maps.Event.addListener(map, "mousedown", beginLongPress);
      window.naver.maps.Event.addListener(map, "touchstart", beginLongPress);
      window.naver.maps.Event.addListener(map, "mouseup", cancelOnGesture);
      window.naver.maps.Event.addListener(map, "touchend", cancelOnGesture);
      window.naver.maps.Event.addListener(map, "dragstart", cancelOnGesture);
      window.naver.maps.Event.addListener(map, "pinchstart", cancelOnGesture);
      window.naver.maps.Event.addListener(map, "click", () => {
        if (longPressTriggered) {
          longPressTriggered = false;
          return;
        }
        if (popupOpenRef.current) {
          requestIdRef.current += 1;
          popupRef.current?.close();
          popupOpenRef.current = false;
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
    const isSearchResults = searchResults !== undefined;
    const markerPlaces = searchResults ?? listPlaces ?? places.filter((place) => !place.isCurrentLocation);
    const first = markerPlaces[0] ?? { latitude: CENTER.latitude, longitude: CENTER.longitude };
    const initial = new window.naver.maps.LatLng(first.latitude, first.longitude);
    const bounds = new window.naver.maps.LatLngBounds(initial, initial);
    const isOptimized = !isSearchResults && !listPlaces && segments.length > 0;
    markerPlaces.forEach((place, index) => {
      const position = new window.naver.maps.LatLng(place.latitude, place.longitude); bounds.extend(position);
      const visitOrder = isSearchResults || listPlaces || !("id" in place)
        ? index + 1
        : places.findIndex((candidate) => candidate.id === place.id) + 1;
      const isStart = visitOrder === 1;
      const isDestination = !returnToStart && visitOrder === places.length;
      const roleClass = isStart ? "start" : isDestination ? "destination" : "waypoint";
      const label = String(visitOrder);
      const listColor = listPlaces?.[index]?.color;
      const markerStyle = isOptimized ? ` style="--marker-color:${routeColor(index)}"` : listColor ? ` style="--marker-color:${listColor}"` : "";
      const markerClass = isSearchResults ? "search-result" : isOptimized || listColor ? "optimized" : roleClass;
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
    if (!listPlaces && !isSearchResults) segments.forEach((segment, index) => {
      if (segment.path.length < 2) return;
      const path = segment.path.map(([longitude, latitude]) => new window.naver.maps.LatLng(latitude, longitude));
      const color = routeColor(index);
      const isHighlighted = highlightedSegmentIndex === index;
      const isDimmed = highlightedSegmentIndex !== null && !isHighlighted;
      const selectSegment = () => segmentSelectRef.current?.(index);
      const hitArea = new window.naver.maps.Polyline({ map, path, strokeColor: color, strokeWeight: 22, strokeOpacity: 0.01, clickable: true });
      const polyline = new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: color,
        strokeWeight: isHighlighted ? 8 : 4,
        strokeOpacity: isDimmed ? 0.42 : (isHighlighted ? 1 : 0.76),
        zIndex: isHighlighted ? 20 : 10,
        clickable: true,
      });
      window.naver.maps.Event.addListener(hitArea, "click", selectSegment);
      window.naver.maps.Event.addListener(polyline, "click", selectSegment);
      overlays.current.push(hitArea, polyline);
    });
    const placesKey = markerPlaces.map((place) => `${"id" in place ? place.id : place.providerId ?? place.name}:${place.latitude}:${place.longitude}`).join("|");
    if (!listPlaces && !isSearchResults && markerPlaces.length > 1 && fittedPlacesKeyRef.current !== placesKey) {
      const isMobileMap = window.matchMedia("(max-width: 700px)").matches;
      const mobileInsets = getMobileMapInsets(nodeRef.current);
      map.fitBounds(bounds, isMobileMap
        ? { top: mobileInsets.top, right: mobileInsets.right, bottom: mobileInsets.bottom, left: mobileInsets.left }
        : { top: 48, right: 48, bottom: 48, left: 48 });
      if (isMobileMap) map.setZoom(map.getZoom() + 1, false);
      fittedPlacesKeyRef.current = placesKey;
    }
  }, [places, segments, highlightedSegmentIndex, listPlaces, searchResults]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver || !focusedSearchResult || !focusedSearchResultRequestId) return;
    const target = new window.naver.maps.LatLng(focusedSearchResult.latitude, focusedSearchResult.longitude);
    const isMobileMap = window.matchMedia("(max-width: 700px)").matches;
    const targetZoom = Math.max(map.getZoom(), isMobileMap ? 15 : 16);
    const moveToFocusedSearchResult = () => {
      const mapRect = nodeRef.current?.getBoundingClientRect();
      if (!mapRect) return;

      const insets = isMobileMap
        ? getMobileMapInsets(nodeRef.current, "mobile-places-panel")
        : { top: 0, right: 0, bottom: 0, left: 0 };
      const visibleHeight = Math.max(1, mapRect.height - insets.top - insets.bottom);
      const desiredY = isMobileMap ? insets.top + (visibleHeight / 2) : mapRect.height / 2;
      const projection = map.getProjection();
      const targetPoint = projection.fromCoordToPoint(target);
      const zoomFactor = projection.factor(targetZoom);
      const adjustedCenter = projection.fromPointToCoord(new window.naver.maps.Point(
        targetPoint.x,
        targetPoint.y + (mapRect.height / 2 - desiredY) / zoomFactor,
      ));
      const transition = { duration: 420, easing: "easeOutCubic" } as naver.maps.TransitionOptions;
      if (map.getZoom() === targetZoom) map.panTo(adjustedCenter, transition);
      else map.morph(adjustedCenter, targetZoom, transition);
    };

    if (!isMobileMap) {
      const frame = window.requestAnimationFrame(moveToFocusedSearchResult);
      return () => window.cancelAnimationFrame(frame);
    }

    const settleTimer = window.setTimeout(moveToFocusedSearchResult, MOBILE_SHEET_SETTLE_DURATION_MS);
    return () => window.clearTimeout(settleTimer);
  }, [focusedSearchResult?.latitude, focusedSearchResult?.longitude, focusedSearchResultRequestId, mapInitialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver || !listPlaces || listPlaces.length === 0 || focusedPlace) return;

    const first = listPlaces[0];
    const bounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(first.latitude, first.longitude),
      new window.naver.maps.LatLng(first.latitude, first.longitude),
    );
    listPlaces.forEach((place) => bounds.extend(new window.naver.maps.LatLng(place.latitude, place.longitude)));

    const isMobileMap = window.matchMedia("(max-width: 700px)").matches;
    const placesKey = listPlaces.map((place) => `${place.id}:${place.latitude}:${place.longitude}`).join("|");
    const fitKey = `list:${placesKey}:${isMobileMap ? "mobile-peek" : "desktop"}`;
    if (fittedPlacesKeyRef.current === fitKey) return;

    const fitListBounds = () => {
      const mobilePeekInsets = getMobilePeekMapInsets(nodeRef.current);
      if (listPlaces.length === 1) {
        const targetZoom = Math.max(map.getZoom(), 15);
        const target = getPathFocusTarget(
          map,
          [[first.longitude, first.latitude]],
          isMobileMap ? getFocusMargin(mobilePeekInsets) : { top: 48, right: 48, bottom: 48, left: 48 },
          targetZoom,
        );
        const transition = { duration: 420, easing: "easeOutCubic" } as naver.maps.TransitionOptions;
        if (map.getZoom() === target.zoom) map.panTo(target.center, transition);
        else map.morph(target.center, target.zoom, transition);
      } else if (!isMobileMap) {
        map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
      } else {
        const target = getPathFocusTarget(
          map,
          listPlaces.map((place) => [place.longitude, place.latitude]),
          getFocusMargin(mobilePeekInsets),
        );
        const transition = { duration: 420, easing: "easeOutCubic" } as naver.maps.TransitionOptions;
        if (map.getZoom() === target.zoom) map.panTo(target.center, transition);
        else map.morph(target.center, target.zoom, transition);
      }
      fittedPlacesKeyRef.current = fitKey;
    };

    if (!isMobileMap) {
      const frame = window.requestAnimationFrame(fitListBounds);
      return () => window.cancelAnimationFrame(frame);
    }

    const settleTimer = window.setTimeout(fitListBounds, MOBILE_SHEET_SETTLE_DURATION_MS);
    return () => window.clearTimeout(settleTimer);
  }, [listPlaces, focusedPlace, mapInitialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver || focusedSegmentIndex === null || focusedSegmentIndex === undefined) return;
    const segment = segments[focusedSegmentIndex];
    if (!segment || segment.path.length < 2) return;
    const isMobileMap = window.matchMedia("(max-width: 700px)").matches;
    const moveToFocusedSegment = () => {
      const baseMargin = isMobileMap
        ? getMobileMapInsets(nodeRef.current, "mobile-results-panel")
        : { top: 52, right: 52, bottom: 52, left: 52 };
      const target = getPathFocusTarget(map, segment.path, getFocusMargin(baseMargin));
      const transition = { duration: 420, easing: "easeOutCubic" } as naver.maps.TransitionOptions;

      if (map.getZoom() === target.zoom) map.panTo(target.center, transition);
      else map.morph(target.center, target.zoom, transition);
    };

    if (!isMobileMap) {
      const frame = window.requestAnimationFrame(moveToFocusedSegment);
      return () => window.cancelAnimationFrame(frame);
    }

    const settleTimer = window.setTimeout(moveToFocusedSegment, MOBILE_SHEET_SETTLE_DURATION_MS);
    return () => window.clearTimeout(settleTimer);
  }, [segments, focusedSegmentIndex, mapInitialized]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver || !focusedPlace) return;

    const target = new window.naver.maps.LatLng(focusedPlace.latitude, focusedPlace.longitude);
    const isMobileMap = window.matchMedia("(max-width: 700px)").matches;
    const targetZoom = Math.max(map.getZoom(), isMobileMap ? 15 : 16);
    const moveToFocusedPlace = (duration = 420) => {
      const mapRect = nodeRef.current?.getBoundingClientRect();
      if (!mapRect) return;

      const insets = isMobileMap
        ? getMobileMapInsets(nodeRef.current, "mobile-lists-panel")
        : { top: 0, right: 0, bottom: 0, left: 0 };
      const desiredX = mapRect.width / 2;
      const visibleHeight = Math.max(1, mapRect.height - insets.top - insets.bottom);
      const desiredY = isMobileMap ? insets.top + (visibleHeight / 2) : mapRect.height / 2;

      // Calculate the final centre before moving. This keeps a single-point marker
      // centred in the visible map area above the mobile sheet without a second
      // setCenter/panBy correction that would make the camera jump.
      const projection = map.getProjection();
      const targetPoint = projection.fromCoordToPoint(target);
      const zoomFactor = projection.factor(targetZoom);
      const adjustedCenter = projection.fromPointToCoord(new window.naver.maps.Point(
        targetPoint.x + (mapRect.width / 2 - desiredX) / zoomFactor,
        targetPoint.y + (mapRect.height / 2 - desiredY) / zoomFactor,
      ));
      const transition = { duration, easing: "easeOutCubic" } as naver.maps.TransitionOptions;

      if (map.getZoom() !== targetZoom) {
        map.morph(adjustedCenter, targetZoom, transition);
      } else {
        map.panTo(adjustedCenter, transition);
      }
    };

    if (!isMobileMap) {
      const frame = window.requestAnimationFrame(() => moveToFocusedPlace());
      return () => window.cancelAnimationFrame(frame);
    }

    const settleTimer = window.setTimeout(() => moveToFocusedPlace(), MOBILE_SHEET_SETTLE_DURATION_MS);
    return () => window.clearTimeout(settleTimer);
  }, [focusedPlace?.latitude, focusedPlace?.longitude, focusedPlaceRequestId, mapInitialized]);

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
      <div className="map-zoom-control" aria-label={"지도 확대 및 축소"}>
        <button type="button" aria-label={"지도 확대"} onClick={() => zoomBy(1)}>
          +
        </button>
        <span aria-hidden="true" />
        <button type="button" aria-label={"지도 축소"} onClick={() => zoomBy(-1)}>
          −
        </button>
      </div>
    </div>
  );
}
