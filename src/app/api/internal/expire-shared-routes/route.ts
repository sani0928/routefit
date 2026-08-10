import { NextRequest, NextResponse } from "next/server";
import { expireSharedRoutes } from "@/lib/shared-routes/repository";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "권한이 없습니다." } }, { status: 401 });
  }

  const expiredCount = await expireSharedRoutes();
  return NextResponse.json({ expiredCount });
}
