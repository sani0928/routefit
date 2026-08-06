"use client";

type ContentLoadingProps = {
  variant: "places" | "collections" | "saved-places";
};

const rowWidths = ["72%", "58%", "80%", "64%"];

export function ContentLoading({ variant }: ContentLoadingProps) {
  const itemCount = variant === "places" ? 4 : variant === "collections" ? 3 : 5;

  return (
    <div className={`content-loading content-loading-${variant}`} role="status" aria-live="polite" aria-label="콘텐츠를 불러오는 중">
      <div className="content-loading-label"><span aria-hidden="true" />불러오는 중</div>
      <div className="content-loading-rows" aria-hidden="true">
        {Array.from({ length: itemCount }, (_, index) => (
          <div className="content-loading-row" key={index}>
            <span className="content-loading-emblem" />
            <span className="content-loading-copy"><i /><i style={{ width: rowWidths[index % rowWidths.length] }} /></span>
            {variant !== "places" && <span className="content-loading-action" />}
          </div>
        ))}
      </div>
    </div>
  );
}