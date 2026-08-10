"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { isSharedCurrentLocation, type SharedRouteSnapshot } from "@/features/shared-routes/types";
import { routeColor } from "@/lib/route-colors";

type Props = {
  snapshot: SharedRouteSnapshot;
  highlightedSegmentIndex: number | null;
  focusedPlaceIndex: number | null;
  onSegmentSelect: (index: number) => void;
};

const DEFAULT_CENTER = { latitude: 36.3504, longitude: 127.3845 };

export function SharedRouteMap({ snapshot, highlightedSegmentIndex, focusedPlaceIndex, onSegmentSelect }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const overlaysRef = useRef<naver.maps.OverlayView[]>([]);
  const selectRef = useRef(onSegmentSelect);
  const viewportRef = useRef({ snapshot, highlightedSegmentIndex, focusedPlaceIndex });
  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const [mapReady, setMapReady] = useState(false);

  viewportRef.current = { snapshot, highlightedSegmentIndex, focusedPlaceIndex };

  const focusSelectedViewport = (targetMap = mapRef.current) => {
    if (!targetMap || !window.naver) return;
    const activeViewport = viewportRef.current;

    if (activeViewport.focusedPlaceIndex !== null) {
      const place = activeViewport.snapshot.result.orderedPlaces[activeViewport.focusedPlaceIndex];
      if (!place) return;
      targetMap.setZoom(15, true);
      targetMap.panTo(new window.naver.maps.LatLng(place.latitude, place.longitude));
      return;
    }

    if (activeViewport.highlightedSegmentIndex === null) return;
    const segment = activeViewport.snapshot.result.segments[activeViewport.highlightedSegmentIndex];
    if (!segment?.path.length) return;
    const [[firstLongitude, firstLatitude], ...rest] = segment.path;
    const bounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(firstLatitude, firstLongitude),
      new window.naver.maps.LatLng(firstLatitude, firstLongitude),
    );
    rest.forEach(([longitude, latitude]) => bounds.extend(new window.naver.maps.LatLng(latitude, longitude)));
    let centered = false;
    const panToSegmentCenter = () => {
      if (centered) return;
      centered = true;
      targetMap.panTo(bounds.getCenter());
    };
    window.naver.maps.Event.once(targetMap, "idle", panToSegmentCenter);
    targetMap.fitBounds(bounds, { top: 72, right: 72, bottom: 72, left: 72 });
    window.setTimeout(panToSegmentCenter, 180);
  };

  useEffect(() => { selectRef.current = onSegmentSelect; }, [onSegmentSelect]);

  useEffect(() => {
    if (!clientId || !nodeRef.current || mapRef.current) return;
    let map: naver.maps.Map | null = null;
    let observer: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let mounted = true;

    const initialize = () => {
      if (!mounted || !nodeRef.current || !window.naver || mapRef.current) return;
      map = new window.naver.maps.Map(nodeRef.current, {
        center: new window.naver.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude),
        zoom: 12,
        zoomControl: false,
      });
      mapRef.current = map;
      setMapReady(true);
      observer = new ResizeObserver(() => {
        if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          const rect = nodeRef.current?.getBoundingClientRect();
          if (map && rect) {
            map.setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
            window.requestAnimationFrame(() => focusSelectedViewport(map));
          }
          resizeFrame = null;
        });
      });
      observer.observe(nodeRef.current);
    };

    if (window.naver?.maps) initialize();
    else {
      const scriptId = "routefit-naver-map-sdk";
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (existing) existing.addEventListener("load", initialize, { once: true });
      else {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
        script.async = true;
        script.addEventListener("load", initialize, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      mounted = false;
      observer?.disconnect();
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
      setMapReady(false);
    };
  }, [clientId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.naver) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const places = snapshot.result.orderedPlaces;
    const first = places[0] ?? DEFAULT_CENTER;
    const bounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(first.latitude, first.longitude),
      new window.naver.maps.LatLng(first.latitude, first.longitude),
    );

    places.forEach((place, index) => {
      const position = new window.naver.maps.LatLng(place.latitude, place.longitude);
      const isReturnToStart = snapshot.returnToStart && index === places.length - 1 && isSharedCurrentLocation(place);
      const markerNumber = isReturnToStart ? 1 : index + 1;
      const markerColor = isReturnToStart ? routeColor(0) : routeColor(index);
      bounds.extend(position);
      const marker = new window.naver.maps.Marker({
        position,
        map,
        title: isSharedCurrentLocation(place) ? "현재 위치" : place.name,
        icon: {
          content: `<div class="map-marker optimized" style="--marker-color:${markerColor}">${markerNumber}</div>`,
          anchor: new window.naver.maps.Point(16, 16),
        },
      });
      overlaysRef.current.push(marker);
    });

    snapshot.result.segments.forEach((segment, index) => {
      const path = segment.path.map(([longitude, latitude]) => new window.naver.maps.LatLng(latitude, longitude));
      const selected = highlightedSegmentIndex === index;
      const dimmed = highlightedSegmentIndex !== null && !selected;
      const select = () => selectRef.current(index);
      const hitArea = new window.naver.maps.Polyline({ map, path, strokeColor: routeColor(index), strokeWeight: 20, strokeOpacity: 0.01, clickable: true });
      const line = new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: routeColor(index),
        strokeWeight: selected ? 8 : 4,
        strokeOpacity: dimmed ? 0.3 : (selected ? 1 : 0.8),
        zIndex: selected ? 20 : 10,
        clickable: true,
      });
      window.naver.maps.Event.addListener(hitArea, "click", select);
      window.naver.maps.Event.addListener(line, "click", select);
      overlaysRef.current.push(hitArea, line);
    });

    if (places.length > 1 && focusedPlaceIndex === null && highlightedSegmentIndex === null) {
      map.fitBounds(bounds, { top: 46, right: 46, bottom: 46, left: 46 });
    }
  }, [snapshot, focusedPlaceIndex, highlightedSegmentIndex, mapReady]);

  useEffect(() => {
    focusSelectedViewport();
  }, [focusedPlaceIndex, highlightedSegmentIndex, mapReady, snapshot]);

  const changeZoom = (amount: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(Math.min(21, Math.max(1, map.getZoom() + amount)), true);
  };

  if (!clientId) return <div className="shared-route-map-placeholder">지도를 불러올 수 없습니다.</div>;
  return <div className="shared-route-map-shell" aria-label="공유 동선 지도">
    <div ref={nodeRef} className="shared-route-map" />
    <div className="shared-route-map-controls" aria-label="지도 확대 및 축소">
      <button type="button" onClick={() => changeZoom(1)} aria-label="지도 확대"><Plus aria-hidden="true" /></button>
      <span aria-hidden="true" />
      <button type="button" onClick={() => changeZoom(-1)} aria-label="지도 축소"><Minus aria-hidden="true" /></button>
    </div>
  </div>;
}
