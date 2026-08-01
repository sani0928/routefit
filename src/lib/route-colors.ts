export const ROUTE_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#4f46e5", "#9333ea", "#e11d48",
  "#c2410c", "#65a30d", "#0d9488", "#0284c7", "#6d28d9",
] as const;

export function routeColor(index: number): string { return ROUTE_COLORS[index % ROUTE_COLORS.length]; }