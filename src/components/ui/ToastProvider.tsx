"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ToastProvider() {
  return <ToastContainer
    position="bottom-center"
    className="routefit-toast-container"
    toastClassName="routefit-toast"
    limit={1}
    autoClose={3000}
    closeButton
    closeOnClick
    draggable="touch"
    pauseOnFocusLoss
    pauseOnHover
    newestOnTop
  />;
}
