"use client";

import { useState } from "react";
import type { MemberState, SavedPlace } from "@/features/member/types";
import type { Place } from "@/features/route-optimization/types/route.types";

export type SavePlaceInput = Omit<Place, "id" | "type"> & { providerId: string; categoryGroupCode?: string };
const EMPTY_MEMBER: MemberState = { authenticated: false, authConfigured: false, placeLists: [] };

export function usePlaceLists() {
  const [member, setMember] = useState<MemberState>(EMPTY_MEMBER);
  const [memberStateReady, setMemberStateReady] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [listManagerOpen, setListManagerOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [focusedSavedPlace, setFocusedSavedPlace] = useState<SavedPlace | null>(null);
  const [focusedSavedPlaceRequest, setFocusedSavedPlaceRequest] = useState(0);
  const [savedPlacesByListId, setSavedPlacesByListId] = useState<Record<string, SavedPlace[]>>({});
  const [saveTarget, setSaveTarget] = useState<SavePlaceInput | null>(null);

  return { member, setMember, memberStateReady, setMemberStateReady, workspaceRestored, setWorkspaceRestored, listManagerOpen, setListManagerOpen, selectedListId, setSelectedListId, focusedSavedPlace, setFocusedSavedPlace, focusedSavedPlaceRequest, setFocusedSavedPlaceRequest, savedPlacesByListId, setSavedPlacesByListId, saveTarget, setSaveTarget };
}
