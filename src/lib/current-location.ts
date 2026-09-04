export type CurrentLocationCoordinates = {
  latitude: number;
  longitude: number;
};

const CURRENT_LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 10_000,
};

const CURRENT_LOCATION_CACHE_MS = 15_000;

let inFlightRequest: Promise<CurrentLocationCoordinates> | null = null;
let cachedLocation: { coordinates: CurrentLocationCoordinates; expiresAt: number } | null = null;

function readCachedLocation() {
  if (!cachedLocation || cachedLocation.expiresAt <= Date.now()) return null;
  return cachedLocation.coordinates;
}

/**
 * Coordinates all client-side geolocation reads so a simultaneous map, search,
 * or calculation request produces only one browser permission/GPS request.
 */
export function requestCurrentLocationCoordinates(): Promise<CurrentLocationCoordinates> {
  const cached = readCachedLocation();
  if (cached) return Promise.resolve(cached);
  if (inFlightRequest) return inFlightRequest;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("CURRENT_LOCATION_UNAVAILABLE"));
  }

  const request = new Promise<CurrentLocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error("CURRENT_LOCATION_UNAVAILABLE")),
      CURRENT_LOCATION_OPTIONS,
    );
  });

  inFlightRequest = request;
  request.then(
    (coordinates) => {
      cachedLocation = { coordinates, expiresAt: Date.now() + CURRENT_LOCATION_CACHE_MS };
      if (inFlightRequest === request) inFlightRequest = null;
    },
    () => {
      if (inFlightRequest === request) inFlightRequest = null;
    },
  );

  return request;
}
