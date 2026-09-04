import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCurrentLocationCoordinates } from "./current-location";

describe("current location service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares an in-flight GPS request and reuses its recent result", async () => {
    let resolvePosition: ((position: GeolocationPosition) => void) | undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      resolvePosition = success;
    });
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    const firstRequest = requestCurrentLocationCoordinates();
    const secondRequest = requestCurrentLocationCoordinates();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    resolvePosition?.({ coords: { latitude: 36.3504, longitude: 127.3845 } } as GeolocationPosition);

    await expect(firstRequest).resolves.toEqual({ latitude: 36.3504, longitude: 127.3845 });
    await expect(secondRequest).resolves.toEqual({ latitude: 36.3504, longitude: 127.3845 });
    await expect(requestCurrentLocationCoordinates()).resolves.toEqual({ latitude: 36.3504, longitude: 127.3845 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
