import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, unauthenticated, badRequest } from "@/lib/member/api";
import { deletePlaceList, getSavedPlaces, updatePlaceList } from "@/lib/member/repository";
import { LIST_COLORS } from "@/features/member/types";

const bodySchema = z.object({ name: z.string().trim().min(1).max(60).optional(), color: z.enum(LIST_COLORS).optional() });

export async function GET(_: Request, context: { params: Promise<{ listId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { listId } = await context.params;
  const places = await getSavedPlaces(user.id, listId);
  return places ? NextResponse.json({ places }) : NextResponse.json({ error: { message: "Place list was not found." } }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ listId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return badRequest("Invalid place-list update.");
  const { listId } = await context.params;
  return (await updatePlaceList(user.id, listId, body.data)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: { message: "Place list was not found." } }, { status: 404 });
}

export async function DELETE(_: Request, context: { params: Promise<{ listId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { listId } = await context.params;
  return (await deletePlaceList(user.id, listId)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: { message: "Place list was not found." } }, { status: 404 });
}