import type { FixedVisitOrder, Place } from "@/features/route-optimization/types/route.types";

export const LIST_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#475569"] as const;
export type ListColor = (typeof LIST_COLORS)[number];

export interface MemberRoutePlan {
  id: string;
  name: string;
  returnToStart: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  places: Place[];
  fixedVisitOrders: FixedVisitOrder[];
}

export interface MemberPlaceList {
  id: string;
  name: string;
  color: ListColor;
  createdAt: string;
  updatedAt: string;
  placeCount: number;
}

export interface SavedPlace {
  id: string;
  placeListId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  providerId: string;
  createdAt: string;
}

export interface MemberWorkspace {
  returnToStart: boolean;
  places: Place[];
  fixedVisitOrders: FixedVisitOrder[];
  updatedAt: string;
}
export interface MemberState {
  authenticated: boolean;
  authConfigured: boolean;
  user?: { id: string; name: string; email: string; image?: string | null };
  workspace?: MemberWorkspace | null;
  placeLists: MemberPlaceList[];
}

export interface RoutePlanDraft {
  name?: string;
  returnToStart: boolean;
  places: Place[];
  fixedVisitOrders: FixedVisitOrder[];
}
