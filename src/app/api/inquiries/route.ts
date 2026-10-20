import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { incrementRateLimit } from "@/lib/cache/route-cache";
import { AppError, apiError } from "@/lib/errors";
import { sendInquiryEmail } from "@/lib/inquiries";
import { getSessionUser } from "@/lib/member/api";
import { inquiryRequestSchema } from "@/lib/validation/inquiry.schema";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000;
const RATE_LIMIT_MAXIMUM = 5;
const globalForInquiryRateLimit = globalThis as typeof globalThis & {
  routeFitInquiryRateLimits?: Map<string, { count: number; resetAt: number }>;
};
const rateLimits = globalForInquiryRateLimit.routeFitInquiryRateLimits ??= new Map();

function getClientIp(request: NextRequest) {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "unknown";
}

async function assertRateLimit(ip: string) {
  const key = createHash("sha256").update(ip).digest("hex");
  const redisCount = await incrementRateLimit(`routefit:inquiry:create:ip:${key}`, RATE_LIMIT_WINDOW_MS / 1_000);
  if (redisCount !== undefined) {
    if (redisCount > RATE_LIMIT_MAXIMUM) throw new AppError("문의는 잠시 후 다시 보내 주세요.", 429, "INQUIRY_RATE_LIMIT");
    return;
  }

  const now = Date.now();
  for (const [storedKey, current] of rateLimits) if (current.resetAt <= now) rateLimits.delete(storedKey);
  const current = rateLimits.get(key);
  if (!current) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (current.count >= RATE_LIMIT_MAXIMUM) throw new AppError("문의는 잠시 후 다시 보내 주세요.", 429, "INQUIRY_RATE_LIMIT");
  current.count += 1;
}

export async function POST(request: NextRequest) {
  try {
    await assertRateLimit(getClientIp(request));
    const input = inquiryRequestSchema.parse(await request.json());
    const user = await getSessionUser();
    if (!user && !input.replyEmail && !input.replyOptOut) {
      throw new AppError("회신 이메일을 입력하거나 이메일 없이 문의하기를 선택해 주세요.", 400, "INQUIRY_REPLY_EMAIL_REQUIRED");
    }

    const replyEmail = user?.email ?? input.replyEmail ?? null;
    await sendInquiryEmail({
      senderName: user?.name ?? "비회원",
      authenticated: Boolean(user),
      replyEmail,
      request: input,
    });
    return NextResponse.json({ received: true, canReply: Boolean(replyEmail) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
