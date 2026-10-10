import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Database, ExternalLink, MapPinned, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin/access";
import { ADMIN_USAGE_PERIODS, getAdminDashboardData, isAdminUsagePeriod, type AdminUsagePeriod } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 콘솔",
  robots: { index: false, follow: false },
};

const formatDateTime = (value: Date | string | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatLastUsedDateTime = (value: Date | string | null) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
};

const formatRangeDay = (day: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "short",
  day: "numeric",
}).format(new Date(`${day}T12:00:00+09:00`));

const usagePeriodTabs: { value: AdminUsagePeriod; label: string }[] = [
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 한 달" },
  { value: "1y", label: "최근 1년" },
];

type AdminConsoleView = "usage" | "shares";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ period?: string | string[]; view?: string | string[] }> }) {
  const admin = await getAdminUser();
  if (!admin) notFound();
  const params = await searchParams;
  const requestedPeriod = typeof params.period === "string" ? params.period : undefined;
  const period = isAdminUsagePeriod(requestedPeriod) ? requestedPeriod : "7d";
  const requestedView = typeof params.view === "string" ? params.view : undefined;
  const view: AdminConsoleView = requestedView === "shares" ? "shares" : "usage";
  const dashboard = await getAdminDashboardData(period);
  const totalDirectionsActivity = dashboard.totals.externalDirectionsRequests + dashboard.totals.cacheHits;
  const cacheHitRate = totalDirectionsActivity > 0 ? Math.round((dashboard.totals.cacheHits / totalDirectionsActivity) * 100) : 0;
  const largestUsageCount = Math.max(...dashboard.usageSeries.map((usage) => usage.externalDirectionsRequests), 1);

  return <main className="admin-page">
    <header className="admin-header">
      <Link href="/" className="admin-brand" aria-label="RouteFit 홈으로 이동"><img src="/icons/logo.png" alt="" /></Link>
      <div className="admin-account"><ShieldCheck size={15} aria-hidden="true" /><span>{admin.email}</span></div>
    </header>

    <section className="admin-hero">
      <span>OPERATIONS</span>
    </section>

    <nav className="admin-console-tabs" aria-label="관리자 콘솔 메뉴">
      <Link href={period === "7d" ? "/admin" : `/admin?period=${period}`} aria-current={view === "usage" ? "page" : undefined} className={view === "usage" ? "is-active" : undefined}>API 호출량</Link>
      <Link href={`/admin?view=shares&period=${period}`} aria-current={view === "shares" ? "page" : undefined} className={view === "shares" ? "is-active" : undefined}>활성 공유 링크 <span>{dashboard.activeShareCount.toLocaleString()}</span></Link>
    </nav>

    {view === "usage" ? <>
      <nav className="admin-period-tabs" aria-label="API 호출 조회 기간">
        {usagePeriodTabs.map((tab) => <Link key={tab.value} href={tab.value === "7d" ? "/admin" : `/admin?period=${tab.value}`} aria-current={period === tab.value ? "page" : undefined} className={period === tab.value ? "is-active" : undefined}>{tab.label}</Link>)}
      </nav>

      <section className="admin-metric-grid" aria-label="운영 핵심 지표">
        <article className="admin-metric-card"><MapPinned aria-hidden="true" /><small>경로 계산</small><strong>{dashboard.totals.routeCalculations.toLocaleString()}건</strong><span>{formatRangeDay(dashboard.fromDay)} ~ {formatRangeDay(dashboard.today)}</span></article>
        <article className="admin-metric-card"><Activity aria-hidden="true" /><small>외부 호출</small><strong>{dashboard.totals.externalDirectionsRequests.toLocaleString()}회</strong><span>NAVER Directions API 기준</span></article>
        <article className="admin-metric-card"><Database aria-hidden="true" /><small>캐시 적중률</small><strong>{cacheHitRate}%</strong><span>캐시 적중 {dashboard.totals.cacheHits.toLocaleString()}회</span></article>
        <article className="admin-metric-card"><Activity aria-hidden="true" /><small>호출 실패</small><strong>{dashboard.totals.failedRequests.toLocaleString()}건</strong><span>계산 시작 후 실패한 요청 기준</span></article>
      </section>

      <section className="admin-panel" aria-labelledby="directions-usage-title">
        <div className="admin-panel-heading"><div><small>NAVER MAPS</small><h2 id="directions-usage-title">Directions 외부 호출</h2></div><span>캐시 적중은 API 호출 비용에 포함되지 않습니다.</span></div>
        <ol className="admin-usage-chart" style={{ gridTemplateColumns: `repeat(${dashboard.usageSeries.length}, minmax(0, 1fr))` }}>{dashboard.usageSeries.map((usage, index) => <li key={`${usage.label}-${index}`}><div className="admin-usage-bar-track"><i style={{ height: `${Math.max(usage.externalDirectionsRequests / largestUsageCount * 100, usage.externalDirectionsRequests > 0 ? 8 : 0)}%` }} /></div><strong>{usage.externalDirectionsRequests}</strong><span>{usage.label}</span></li>)}</ol>
        <p className="admin-panel-footnote">호출 실패 : {dashboard.totals.failedRequests.toLocaleString()}건</p>
      </section>

      <section className="admin-panel" aria-labelledby="member-usage-title">
        <div className="admin-panel-heading"><div><small>MEMBER ACTIVITY</small><h2 id="member-usage-title">회원별 Directions 사용량</h2></div><span>외부 호출 많은 순 · 최대 50개</span></div>
        {dashboard.actorUsage.length > 0 ? <>
          <div className="admin-member-usage-scroll"><table className="admin-member-usage-table"><thead><tr><th>회원</th><th>경로 계산</th><th>외부 호출</th><th>캐시 적중</th><th>실패</th><th>최근 사용 날짜</th></tr></thead><tbody>{dashboard.actorUsage.map((usage) => <tr key={usage.actorKey}><td>{usage.userEmail ? <><strong>{usage.userName}</strong><span>{usage.userEmail}</span></> : <strong>비회원</strong>}</td><td>{usage.routeCalculations.toLocaleString()}건</td><td>{usage.externalDirectionsRequests.toLocaleString()}회</td><td>{usage.cacheHits.toLocaleString()}회</td><td>{usage.failedRequests.toLocaleString()}건</td><td>최근 사용 날짜 : {formatLastUsedDateTime(usage.lastUsedAt)}</td></tr>)}</tbody></table></div>
          <div className="admin-member-usage-cards">{dashboard.actorUsage.map((usage) => <article key={usage.actorKey} className="admin-member-usage-card"><header><div><strong>{usage.userEmail ? usage.userName : "비회원"}</strong><span>{usage.userEmail ?? "로그인 없이 사용"}</span></div><time>최근 사용 날짜 : {formatLastUsedDateTime(usage.lastUsedAt)}</time></header><dl><div><dt>외부 호출</dt><dd>{usage.externalDirectionsRequests.toLocaleString()}회</dd></div><div><dt>경로 계산</dt><dd>{usage.routeCalculations.toLocaleString()}건</dd></div></dl><p><span>캐시 적중 {usage.cacheHits.toLocaleString()}회</span><span>실패 {usage.failedRequests.toLocaleString()}건</span></p></article>)}</div>
        </> : <p className="admin-empty-state">선택한 기간의 회원 또는 비회원 API 사용 기록이 없습니다.</p>}
        <p className="admin-panel-footnote">회원 이메일은 운영 목적의 관리자 화면에서만 표시되며, API 사용량 테이블에는 저장하지 않습니다.</p>
      </section>
    </> : <section className="admin-panel" aria-labelledby="active-share-title">
      <div className="admin-panel-heading"><div><small>PUBLIC LINKS</small><h2 id="active-share-title">활성 공유 링크</h2></div><span>현재 {dashboard.activeShareCount.toLocaleString()}개 · 최대 최근 50개</span></div>
      {dashboard.activeShares.length > 0 ? <><div className="admin-share-scroll"><table className="admin-share-table"><thead><tr><th>공유 ID</th><th>생성자</th><th>생성</th><th>만료</th><th><span className="sr-only">공개 링크</span></th></tr></thead><tbody>{dashboard.activeShares.map((share) => <tr key={share.shareId}><td><code>{share.shareId}</code></td><td>{share.creatorEmail ?? "연결된 계정 없음"}</td><td>{formatDateTime(share.createdAt)}</td><td>{formatDateTime(share.expiresAt)}</td><td><Link href={`/share/${share.shareId}`} target="_blank" rel="noreferrer" aria-label={`${share.shareId} 공유 링크 열기`}><ExternalLink size={15} aria-hidden="true" />열기</Link></td></tr>)}</tbody></table></div><div className="admin-share-cards">{dashboard.activeShares.map((share) => <article key={share.shareId} className="admin-share-card"><header><div className="admin-share-card-identity"><code>{share.shareId}</code><span>{share.creatorEmail ?? "연결된 계정 없음"}</span></div><Link href={`/share/${share.shareId}`} target="_blank" rel="noreferrer" aria-label={`${share.shareId} 공유 링크 열기`}><ExternalLink size={15} aria-hidden="true" />열기</Link></header><dl><div><dt>생성 날짜</dt><dd>{formatDateTime(share.createdAt)}</dd></div><div><dt>만료 날짜</dt><dd>{formatDateTime(share.expiresAt)}</dd></div></dl></article>)}</div></> : <p className="admin-empty-state">현재 활성화된 공유 링크가 없습니다.</p>}
    </section>}
  </main>;
}
