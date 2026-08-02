"use client";

import { LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

interface Props {
  authConfigured: boolean;
  onBeforeLogin: () => void;
  onSessionChange: () => void;
}

export function MemberHeader({ authConfigured, onBeforeLogin, onSessionChange }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const [showSignedOutNotice, setShowSignedOutNotice] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (session?.user) onSessionChange();
  }, [session?.user?.id, onSessionChange]);

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  function showSignOutNotice() {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setShowSignedOutNotice(true);
    noticeTimerRef.current = window.setTimeout(() => {
      setShowSignedOutNotice(false);
      noticeTimerRef.current = null;
    }, 3000);
  }

  async function handleSignOut() {
    const result = await authClient.signOut();
    if (result.error) return;
    onSessionChange();
    showSignOutNotice();
  }

  if (isPending) return <div className="member-auth-skeleton" />;

  return <div className="member-auth">
    {!session?.user ? (
      <button
        className="member-login"
        type="button"
        disabled={!authConfigured}
        aria-label="Google 로그인"
        title={authConfigured ? "Google 로그인" : "Google 로그인 환경 변수를 설정해 주세요"}
        onClick={async () => {
          onBeforeLogin();
          await authClient.signIn.social({ provider: "google", callbackURL: "/" });
        }}
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
          <button type="button" onClick={handleSignOut}><LogOut size={14} /> 로그아웃</button>
        </div>
      </details>
    )}
    {showSignedOutNotice && <p className="member-signed-out-notice" role="status">안전하게 로그아웃 되었습니다</p>}
  </div>;
}