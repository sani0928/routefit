import { RouteFitPlanner } from "@/components/planner/RouteFitPlanner";

const WEB_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "RouteFit",
  alternateName: "루트핏",
  url: "https://www.routefit.co.kr/",
  description: "여러 방문 장소의 이동 경로를 쉽고 빠르게 최적화하는 서비스",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web browser",
  inLanguage: "ko-KR",
  image: "https://www.routefit.co.kr/images/og_image.png",
  offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  featureList: ["여러 방문 장소 추가", "방문 순서 최적화", "실시간 교통정보 기반 경로 계산"],
};

export default function Home() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APPLICATION_JSON_LD).replace(/</g, "\\u003c") }} />
    <RouteFitPlanner />
  </>;
}

