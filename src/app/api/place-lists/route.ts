import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, unauthenticated, badRequest } from "@/lib/member/api";
import { createPlaceList, getPlaceLists } from "@/lib/member/repository";
import { LIST_COLORS } from "@/features/member/types";
const bodySchema = z.object({ name: z.string().trim().min(1).max(60), color: z.enum(LIST_COLORS) });
export async function GET() { const user = await getSessionUser(); return user ? NextResponse.json({ lists: await getPlaceLists(user.id) }) : unauthenticated(); }
export async function POST(request: Request) { const user = await getSessionUser(); if (!user) return unauthenticated(); const body = bodySchema.safeParse(await request.json()); if (!body.success) return badRequest("리스트 이름 또는 색상이 올바르지 않습니다."); try { return NextResponse.json({ list: await createPlaceList(user.id, body.data.name, body.data.color) }, { status: 201 }); } catch (error) { return badRequest(error instanceof Error ? error.message : "리스트를 만들 수 없습니다."); } }