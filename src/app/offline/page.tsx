import { OfflineRetryButton } from "@/components/pwa/OfflineRetryButton";

export default function OfflinePage() {
  return <main className="offline-page">
    <div className="offline-page-card">
      <img src="/icons/logo.png" alt="RouteFit" />
      <p>오프라인 상태</p>
      <h1>인터넷 연결 후 다시 시도해 주세요.</h1>
      <span>지도, 장소 검색, 실시간 경로 계산은 인터넷 연결이 필요합니다.</span>
      <OfflineRetryButton />
    </div>
  </main>;
}
