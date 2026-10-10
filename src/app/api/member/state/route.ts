import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/access";
import { getSessionUser, isGoogleAuthConfigured } from "@/lib/member/api";
import { createDefaultFavoriteList, getMemberWorkspace, getPlaceLists } from "@/lib/member/repository";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ authenticated: false, authConfigured: false, isAdmin: false, placeLists: [], workspace: null });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, authConfigured: isGoogleAuthConfigured, isAdmin: false, placeLists: [], workspace: null });
  }
  await createDefaultFavoriteList(user.id);
  const [placeLists, workspace] = await Promise.all([getPlaceLists(user.id), getMemberWorkspace(user.id)]);
  return NextResponse.json({
    authenticated: true,
    authConfigured: isGoogleAuthConfigured,
    isAdmin: isAdminUser(user),
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
    placeLists,
    workspace,
  });
}
