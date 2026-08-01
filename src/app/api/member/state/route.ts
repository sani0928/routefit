import { NextResponse } from "next/server";
import { getSessionUser, isGoogleAuthConfigured } from "@/lib/member/api";
import { createDefaultFavoriteList, getPlaceLists, getRoutePlans } from "@/lib/member/repository";

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ authenticated: false, authConfigured: false, routePlans: [], placeLists: [] });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ authenticated: false, authConfigured: isGoogleAuthConfigured, routePlans: [], placeLists: [] });
  await createDefaultFavoriteList(user.id);
  return NextResponse.json({ authenticated: true, authConfigured: isGoogleAuthConfigured, user: { id: user.id, name: user.name, email: user.email, image: user.image }, routePlans: await getRoutePlans(user.id), placeLists: await getPlaceLists(user.id) });
}