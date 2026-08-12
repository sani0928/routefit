"use client";

import { useState } from "react";

export function useRouteSharing() {
  const [isSharingRoute, setIsSharingRoute] = useState(false);
  const [shareDialogUrl, setShareDialogUrl] = useState<string | null>(null);
  return { isSharingRoute, setIsSharingRoute, shareDialogUrl, setShareDialogUrl };
}
