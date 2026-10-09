"use client";

import Link from "next/link";
import { BookOpen, BookmarkCheck, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/notify";

interface Props {
  authConfigured: boolean;
  onBeforeLogin: () => void;
  onSessionChange: () => void;
}

export function MemberHeader({ authConfigured, onBeforeLogin, onSessionChange }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const [isLoginIntroOpen, setIsLoginIntroOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const loginContinueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (session?.user) onSessionChange();
  }, [session?.user?.id, onSessionChange]);

  useEffect(() => {
    if (!isLoginIntroOpen) return;
    loginContinueButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsLoginIntroOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isLoginIntroOpen]);

  async function handleSignOut() {
    const result = await authClient.signOut();
    if (result.error) return notify.error("로그아웃에 실패했습니다.");
    onSessionChange();
    notify.success("안전하게 로그아웃되었습니다.");
  }

  async function continueWithGoogle() {
    onBeforeLogin();
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  }

  const loginIntro = isLoginIntroOpen && isMounted ? createPortal(
    <div
      className="login-intro-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsLoginIntroOpen(false);
      }}
    >
      <section className="login-intro-dialog" role="dialog" aria-modal="true" aria-labelledby="login-intro-title">
        <button className="login-intro-close" type="button" onClick={() => setIsLoginIntroOpen(false)} aria-label="로그인 안내 닫기">
          <X size={20} aria-hidden="true" />
        </button>
        <span className="login-intro-eyebrow">ROUTEFIT MEMBER</span>
        <h2 id="login-intro-title">로그인하면 동선 관리가 더 편해져요</h2>
        <p className="login-intro-description">나만의 방문 장소를 안전하게 이어서 관리할 수 있습니다.</p>
        <ul className="login-intro-benefits">
          <li><span><BookmarkCheck size={19} aria-hidden="true" /></span><div><strong>장소 리스트 저장</strong><small>자주 가는 장소를 리스트로 모아 다음 동선에 바로 추가할 수 있어요.</small></div></li>
          <li><span><UserRound size={19} aria-hidden="true" /></span><div><strong>방문 장소와 설정 유지</strong><small>다음에 다시 접속해도 저장한 작업 공간을 이어서 사용할 수 있어요.</small></div></li>
        </ul>
        <div className="login-intro-security">
          <ShieldCheck size={20} aria-hidden="true" />
          <p><strong>Google의 보안 로그인으로 진행돼요</strong><span>비밀번호를 입력하거나 저장하지 않으며, Google이 직접 인증을 처리합니다.</span></p>
        </div>
        <div className="login-intro-actions">
          <button className="login-intro-secondary" type="button" onClick={() => setIsLoginIntroOpen(false)}>나중에 할게요</button>
          <button className="login-intro-primary" type="button" ref={loginContinueButtonRef} onClick={() => void continueWithGoogle()}><img src="/icons/google.png" alt="" />Google로 계속하기</button>
        </div>
      </section>
    </div>,
    document.body,
  ) : null;

  if (isPending) return <div className="member-auth-skeleton" />;

  return <>
    <div className="member-auth">
      {!session?.user ? (
        <button
          className="member-login"
          type="button"
          disabled={!authConfigured}
          aria-label="Google 로그인 안내 열기"
          title={authConfigured ? "Google 로그인" : "Google 로그인 환경 변수를 설정해 주세요"}
          onClick={() => setIsLoginIntroOpen(true)}
        >
          <img src="/icons/google.png" alt="" />
        </button>
      ) : (
        <details className="member-profile">
          <summary aria-label="프로필 메뉴" title="프로필 메뉴">
            <span className="member-avatar">
              {session.user.image ? <img src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <UserRound size={15} />}
            </span>
          </summary>
          <div className="member-profile-menu">
            <p>{session.user.email}</p>
            <Link href="/guide"><BookOpen size={14} /> 1분 체험 가이드</Link>
            <button type="button" onClick={handleSignOut}><LogOut size={14} /> 로그아웃</button>
          </div>
        </details>
      )}
    </div>
    {loginIntro}
  </>;
}
