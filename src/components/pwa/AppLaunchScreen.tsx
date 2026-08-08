"use client";

import { useEffect, useState } from "react";

export function AppLaunchScreen() {
  const [isLeaving, setLeaving] = useState(false);
  const [isVisible, setVisible] = useState(true);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 120);
    const removeTimer = window.setTimeout(() => setVisible(false), 300);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return <div className={`app-launch-screen${isLeaving ? " is-leaving" : ""}`} aria-hidden="true">
    <img src="/icons/icon_512.png" alt="" />
  </div>;
}
