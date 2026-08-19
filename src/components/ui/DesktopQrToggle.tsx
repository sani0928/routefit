"use client";

import { Smartphone } from "lucide-react";
import { useState } from "react";

export function DesktopQrToggle() {
  const [isQrVisible, setIsQrVisible] = useState(false);

  return (
    <div className={`routefit-qr-toggle${isQrVisible ? " is-qr-visible" : ""}`}>
      <button
        type="button"
        className="routefit-qr-toggle-button"
        onClick={() => setIsQrVisible((current) => !current)}
        aria-label={isQrVisible ? "QR 코드 닫기" : "RouteFit QR 코드 보기"}
        aria-expanded={isQrVisible}
      >
        <Smartphone className="routefit-qr-toggle-icon" aria-hidden="true" />
        <img className="routefit-qr-toggle-image" src="/images/qr_code.svg" alt="" draggable={false} />
      </button>
    </div>
  );
}
