"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ToastProvider() {
  return <ToastContainer
    position="bottom-center"
    autoClose={3000}
    closeButton
    closeOnClick
    draggable
    pauseOnFocusLoss
    pauseOnHover
    newestOnTop
    limit={3}
  />;
}