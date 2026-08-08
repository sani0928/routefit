"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OnlineStatusBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (online) return null;
  return <div className="offline-status-banner" role="status" aria-live="polite"><WifiOff size={17} aria-hidden="true" /><span>인터넷 연결이 필요합니다.</span></div>;
}
