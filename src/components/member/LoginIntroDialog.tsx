"use client";

import { BookmarkCheck, Share2, ShieldCheck, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authClient } from "@/lib/auth-client";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EXIT_ANIMATION_MILLISECONDS = 180;

export function LoginIntroDialog({ open, onClose }: Props) {
  const [isMounted, setIsMounted] = useState(false);
  const [isRendered, setIsRendered] = useState(open);
  const [isExiting, setIsExiting] = useState(false);
  const loginContinueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      setIsExiting(false);
      return;
    }
    if (!isRendered) return;
    setIsExiting(true);
    const timer = window.setTimeout(() => setIsRendered(false), EXIT_ANIMATION_MILLISECONDS);
    return () => window.clearTimeout(timer);
  }, [isRendered, open]);

  useEffect(() => {
    if (!open || !isRendered) return;
    const focusTimer = window.requestAnimationFrame(() => loginContinueButtonRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isRendered, onClose, open]);

  async function continueWithGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  }

  if (!isMounted || !isRendered) return null;

  return createPortal(
    <div
      className={`login-intro-backdrop${isExiting ? " is-exiting" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`login-intro-dialog${isExiting ? " is-exiting" : ""}`} role="dialog" aria-modal="true" aria-labelledby="login-intro-title">
        <button className="login-intro-close" type="button" onClick={onClose} aria-label="로그인 안내 닫기">
          <X size={20} aria-hidden="true" />
        </button>
        <span className="login-intro-eyebrow">ROUTEFIT LOGIN</span>
        {/* <h2 id="login-intro-title">로그인하면 동선 관리가 더 편해져요</h2> */}
        {/* <p className="login-intro-description">나만의 방문 장소를 더욱 편리하게 관리할 수 있습니다.</p> */}
        <p className="login-intro-description"></p>
        <ul className="login-intro-benefits">
          <li><span><BookmarkCheck size={19} aria-hidden="true" /></span><div><strong>장소 리스트 저장</strong><small>자주 가는 장소를 리스트로 모아 편하게 관리할 수 있어요.</small></div></li>
          <li><span><UserRound size={19} aria-hidden="true" /></span><div><strong>방문 장소와 설정 유지</strong><small>다시 접속해도 저장한 방문 장소를 이어서 사용할 수 있어요.</small></div></li>
          <li><span><Share2 size={19} aria-hidden="true" /></span><div><strong>공유 링크 생성</strong><small>계산한 동선을 지인들과 간편하게 공유할 수 있어요.</small></div></li>
        </ul>
        <div className="login-intro-security">
          <ShieldCheck size={20} aria-hidden="true" />
          <p><strong>Google의 보안 로그인으로 안전하게 진행돼요</strong><span>루트핏에 비밀번호를 입력하거나 저장하지 않으며,<br></br>Google이 직접 인증을 처리합니다.</span></p>
        </div>
        <div className="login-intro-actions">
          <button className="login-intro-secondary" type="button" onClick={onClose}>나중에 할게요</button>
          <button className="login-intro-primary" type="button" ref={loginContinueButtonRef} onClick={() => void continueWithGoogle()}><img src="/icons/google.png" alt="" />Google로 계속하기</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
