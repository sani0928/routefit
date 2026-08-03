"use client";

import { toast, type ToastOptions } from "react-toastify";

type ToastKind = "info" | "success" | "error";

const optionsFor = (kind: ToastKind, message: string): ToastOptions => ({
  autoClose: kind === "error" ? 5000 : 3000,
  hideProgressBar: true,
  toastId: `routefit-${kind}-${message}`,
});

function show(kind: ToastKind, message: string) {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return;

  return toast[kind](normalizedMessage, optionsFor(kind, normalizedMessage));
}

export const notify = {
  info: (message: string) => show("info", message),
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
};