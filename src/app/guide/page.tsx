import type { Metadata } from "next";
import { InteractiveGuide } from "@/components/guide/InteractiveGuide";

export const metadata: Metadata = {
  title: { absolute: "루트핏 (RouteFit) 사용 가이드" },
  description: "영업·외근, 배송·현장 업무, 여행 일정, 데이트 코스 등 여러 장소의 방문 순서와 이동 경로를 루트핏(RouteFit)에서 정리해 보세요.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "루트핏 (RouteFit) 사용 가이드",
    description: "여러 장소를 추가하고 이동 순서를 정하는 과정을 루트핏에서 직접 체험해 보세요.",
    url: "/guide",
  },
};

export default function GuidePage() {
  return <InteractiveGuide />;
}
