"use client";

export function OfflineRetryButton() {
  return <button type="button" onClick={() => window.location.reload()}>다시 시도</button>;
}
