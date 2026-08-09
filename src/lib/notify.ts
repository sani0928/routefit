"use client";

import { toast, type ToastOptions } from "react-toastify";
import { Check, CircleX, Info } from "lucide-react";
import { createElement } from "react";

type ToastKind = "info" | "success" | "error";

const toastIcons = {
  info: () => createElement(Info, { "aria-hidden": true }),
  success: () => createElement(Check, { "aria-hidden": true }),
  error: () => createElement(CircleX, { "aria-hidden": true }),
};

const optionsFor = (kind: ToastKind): ToastOptions => ({
  autoClose: kind === "error" ? 5000 : 3000,
  hideProgressBar: true,
  icon: toastIcons[kind],
});

function show(kind: ToastKind, message: string) {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return;

  toast.clearWaitingQueue();
  toast.dismiss();
  return toast[kind](normalizedMessage, optionsFor(kind));
}

export const notify = {
  info: (message: string) => show("info", message),
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
};
