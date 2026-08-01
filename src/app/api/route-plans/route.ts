import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, unauthenticated, badRequest } from "@/lib/member/api";
import { createRoutePlan, getRoutePlans } from "@/lib/member/repository";
const bodySchema = z.object({ name: z.string().trim().min(1).max(60), copyFromId: z.string().optional() });
export async function GET() { const user = await getSessionUser(); return user ? NextResponse.json({ plans: await getRoutePlans(user.id) }) : unauthenticated(); }
export async function POST(request: Request) { const user = await getSessionUser(); if (!user) return unauthenticated(); const body = bodySchema.safeParse(await request.json()); if (!body.success) return badRequest("동선 이름을 1~60자로 입력해 주세요."); try { const plans = await getRoutePlans(user.id); const source = body.data.copyFromId ? plans.find((plan) => plan.id === body.data.copyFromId) : undefined; return NextResponse.json({ plan: await createRoutePlan(user.id, body.data.name, source) }, { status: 201 }); } catch (error) { return badRequest(error instanceof Error ? error.message : "동선을 만들 수 없습니다."); } }