export function formatSearchDistance(distanceMeters?: number) {
  if (distanceMeters === undefined || !Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1_000) return `${Math.round(distanceMeters)}m`;
  return `${(distanceMeters / 1_000).toFixed(distanceMeters >= 10_000 ? 0 : 1)}km`;
}
