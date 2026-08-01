import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, isGoogleAuthConfigured } from "@/lib/auth";

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export function unauthenticated() { return NextResponse.json({ error: { message: "로그인이 필요합니다." } }, { status: 401 }); }
export function badRequest(message: string) { return NextResponse.json({ error: { message } }, { status: 400 }); }
export { isGoogleAuthConfigured };