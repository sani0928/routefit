"use client";

import { toast, type Id, type ToastOptions } from "react-toastify";
import { Check, CircleX, Info } from "lucide-react";
import { createElement } from "react";

type ToastKind = "info" | "success" | "error";
type RecentToast = { kind: ToastKind; message: string; shownAt: number };

const DUPLICATE_TOAST_WINDOW = 750;
let activeToastId: Id | null = null;
let recentToast: RecentToast | null = null;
let shakeSequence = 0;
let autoDismissTimer: number | null = null;

const toastIcons = {
  info: () => createElement(Info, { "aria-hidden": true }),
  success: () => createElement(Check, { "aria-hidden": true }),
  error: () => createElement(CircleX, { "aria-hidden": true }),
};

const renderMessage = (message: string) => createElement("span", { className: "routefit-toast-message" }, message);

const optionsFor = (kind: ToastKind): ToastOptions => ({
  autoClose: toastDurationFor(kind),
  hideProgressBar: true,
  icon: toastIcons[kind],
});

const toastDurationFor = (kind: ToastKind) => kind === "error" ? 5000 : 3000;

function clearAutoDismissTimer() {
  if (autoDismissTimer === null) return;
  window.clearTimeout(autoDismissTimer);
  autoDismissTimer = null;
}

function scheduleAutoDismiss(toastId: Id, kind: ToastKind) {
  clearAutoDismissTimer();
  autoDismissTimer = window.setTimeout(() => {
    autoDismissTimer = null;
    if (activeToastId === toastId) toast.dismiss(toastId);
  }, toastDurationFor(kind));
}

function show(kind: ToastKind, message: string) {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return;

  const shownAt = Date.now();
  if (recentToast?.kind === kind && recentToast.message === normalizedMessage && shownAt - recentToast.shownAt < DUPLICATE_TOAST_WINDOW) {
    return activeToastId ?? undefined;
  }
  recentToast = { kind, message: normalizedMessage, shownAt };

  if (activeToastId !== null && toast.isActive(activeToastId)) {
    shakeSequence += 1;
    toast.update(activeToastId, {
      render: renderMessage(normalizedMessage),
      type: kind,
      className: `routefit-toast routefit-toast--shake-${shakeSequence % 2 === 0 ? "a" : "b"}`,
      ...optionsFor(kind),
    });
    scheduleAutoDismiss(activeToastId, kind);
    return activeToastId;
  }

  activeToastId = null;
  clearAutoDismissTimer();
  toast.clearWaitingQueue();
  let nextToastId: Id | null = null;
  nextToastId = toast[kind](renderMessage(normalizedMessage), {
    ...optionsFor(kind),
    onClose: () => {
      if (activeToastId === nextToastId) {
        activeToastId = null;
        clearAutoDismissTimer();
      }
    },
  });
  activeToastId = nextToastId;
  scheduleAutoDismiss(nextToastId, kind);
  return nextToastId;
}

export const notify = {
  info: (message: string) => show("info", message),
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
};
