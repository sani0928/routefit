"use client";

export function RouteSettings({ returnToStart, onReturnChange }: { returnToStart: boolean; onReturnChange: (value: boolean) => void }) {
  return <section className="settings"><label className="toggle"><input type="checkbox" checked={returnToStart} onChange={(event) => onReturnChange(event.target.checked)} /> 출발지로 복귀</label></section>;
}