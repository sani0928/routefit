"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISS_KEY = "routefit:pwa-install-dismissed-until";
const INSTALL_DELAY_MS = 10_000;
const INSTALL_DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
}

function canShowInstallPrompt() {
  const dismissedUntil = Number(window.localStorage.getItem(INSTALL_DISMISS_KEY) ?? 0);
  return !isStandalone() && (!Number.isFinite(dismissedUntil) || dismissedUntil <= Date.now());
}

export function PwaLifecycle() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installEligible, setInstallEligible] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const reloadAfterUpdateRef = useRef(false);

  useEffect(() => {
    // A production PWA service worker can continue controlling localhost after
    // switching back to `next dev`. Turbopack development chunk names are not
    // immutable, so an old cached chunk can reference an icon module that no
    // longer exists. Keep development entirely service-worker free.
    if (process.env.NODE_ENV === "production" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("routefit-") || key.startsWith("workbox-"))
        .map((key) => caches.delete(key))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !window.isSecureContext) return;

    let active = true;
    const revealUpdate = () => {
      if (active && navigator.serviceWorker.controller) setUpdateReady(true);
    };

    void navigator.serviceWorker.register("/sw.js").then((nextRegistration) => {
      if (!active) return;
      setRegistration(nextRegistration);
      if (nextRegistration.waiting) revealUpdate();
      nextRegistration.addEventListener("updatefound", () => {
        const installing = nextRegistration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") revealUpdate();
        });
      });
    }).catch(() => undefined);

    const handleControllerChange = () => {
      if (reloadAfterUpdateRef.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const markInteraction = () => setHasInteracted(true);
    window.addEventListener("pointerdown", markInteraction, { once: true, passive: true });
    window.addEventListener("keydown", markInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setInstallEligible(true), INSTALL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
      setInstallDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismissInstall = () => {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + INSTALL_DISMISS_MS));
    setInstallDismissed(true);
  };

  const applyUpdate = () => {
    if (!registration?.waiting) return;
    reloadAfterUpdateRef.current = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "accepted") setInstallDismissed(true);
    else dismissInstall();
  };

  const showInstall = installEligible && hasInteracted && !installDismissed && canShowInstallPrompt();
  const showIosInstall = showInstall && !installEvent && isIosSafari();

  return <>
    {updateReady && <aside className="pwa-update-notice" role="status" aria-live="polite">
      <div><strong>새 버전이 준비되었습니다.</strong><span>새로고침하면 최신 RouteFit를 사용할 수 있어요.</span></div>
      <div className="pwa-notice-actions"><button type="button" onClick={() => setUpdateReady(false)}>나중에</button><button type="button" className="primary" onClick={applyUpdate}>새로고침</button></div>
    </aside>}
    {showInstall && installEvent && <aside className="pwa-install-notice" role="dialog" aria-label="RouteFit 설치">
      <div><strong>RouteFit를 앱으로 설치하세요</strong><span>더욱 간편하고 빠르게 동선을 확인할 수 있어요.</span></div>
      <div className="pwa-notice-actions"><button type="button" onClick={dismissInstall}>나중에</button><button type="button" className="primary" onClick={() => void install()}>설치</button></div>
    </aside>}
    {showIosInstall && <aside className="pwa-install-notice" role="dialog" aria-label="RouteFit 설치 안내">
      <div><strong>RouteFit를 홈 화면에 추가하세요</strong><span>Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하면 더욱 간편하게 RouteFit를 이용하실 수 있어요!</span></div>
      <div className="pwa-notice-actions"><button type="button" onClick={dismissInstall}>확인</button></div>
    </aside>}
  </>;
}
