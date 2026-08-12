"use client";

import { useRef, useState } from "react";
import type { PlaceSearchResult } from "@/features/place-search/types";
import type { Place } from "@/features/route-optimization/types/route.types";

export type SearchResultSort = "accuracy" | "current-distance" | "map-center-distance";
type LocationCoordinates = Pick<Place, "latitude" | "longitude">;

export function usePlaceSearch() {
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [searchMapResults, setSearchMapResults] = useState<PlaceSearchResult[]>([]);
  const [searchResultSort, setSearchResultSort] = useState<SearchResultSort>("accuracy");
  const [searchCurrentLocation, setSearchCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [searchCurrentLocationLocating, setSearchCurrentLocationLocating] = useState(false);
  const [mapCenter, setMapCenter] = useState<LocationCoordinates | null>(null);
  const [searchMapCenter, setSearchMapCenter] = useState<LocationCoordinates | null>(null);
  const [searchMapCenterRequest, setSearchMapCenterRequest] = useState(0);
  const [hasVisibleSearchResult, setHasVisibleSearchResult] = useState(true);
  const [isSearchResultsLoading, setSearchResultsLoading] = useState(false);
  const [isSearchViewportSettling, setSearchViewportSettling] = useState(false);
  const [searchResultsFocusRequest, setSearchResultsFocusRequest] = useState(0);
  const [focusedSearchResult, setFocusedSearchResult] = useState<PlaceSearchResult | null>(null);
  const [focusedSearchResultRequest, setFocusedSearchResultRequest] = useState(0);
  const searchCurrentLocationRequestRef = useRef(0);

  return { searchQuery, setSearchQuery, searchMapResults, setSearchMapResults, searchResultSort, setSearchResultSort, searchCurrentLocation, setSearchCurrentLocation, searchCurrentLocationLocating, setSearchCurrentLocationLocating, mapCenter, setMapCenter, searchMapCenter, setSearchMapCenter, searchMapCenterRequest, setSearchMapCenterRequest, hasVisibleSearchResult, setHasVisibleSearchResult, isSearchResultsLoading, setSearchResultsLoading, isSearchViewportSettling, setSearchViewportSettling, searchResultsFocusRequest, setSearchResultsFocusRequest, focusedSearchResult, setFocusedSearchResult, focusedSearchResultRequest, setFocusedSearchResultRequest, searchCurrentLocationRequestRef };
}
