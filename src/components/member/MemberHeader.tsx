"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

interface Props { authConfigured: boolean; onBeforeLogin: () => void; onSessionChange: () => void; }
export function MemberHeader({ authConfigured, onBeforeLogin, onSessionChange }: Props) {
  const { data: session, isPending } = authClient.useSession();
  useEffect(() => { if (session?.user) onSessionChange(); }, [session?.user?.id, onSessionChange]);
  if (isPending) return <div className="member-auth-skeleton" />;
  if (!session?.user) return <button className="member-login" type="button" disabled={!authConfigured} title={authConfigured ? "Google로 로그인" : "Google 로그인 환경 변수를 설정해 주세요."} onClick={async () => { onBeforeLogin(); await authClient.signIn.social({ provider: "google", callbackURL: "/" }); }}><LogIn size={15} /> Google 로그인</button>;
  return <details className="member-profile"><summary><span className="member-avatar">{session.user.image ? <img src={session.user.image} alt="" /> : <UserRound size={15} />}</span><span>{session.user.name}</span></summary><div className="member-profile-menu"><p>{session.user.email}</p><button type="button" onClick={async () => { await authClient.signOut(); onSessionChange(); }}><LogOut size={14} /> 로그아웃</button></div></details>;
}