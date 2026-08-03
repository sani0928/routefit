import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getSessionUser, unauthenticated } from "@/lib/member/api";
import { getMemberWorkspace, saveMemberWorkspace } from "@/lib/member/repository";

const placeSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  type: z.enum(["START", "WAYPOINT", "DESTINATION"]),
  stayDurationMinutes: z.number().int().min(0).max(1440).optional(),
  isCurrentLocation: z.boolean().optional(),
});

const workspaceSchema = z.object({
  returnToStart: z.boolean(),
  places: z.array(placeSchema).max(15),
  fixedVisitOrders: z.array(z.object({
    placeId: z.string().min(1).max(120),
    visitOrder: z.number().int().min(1).max(15),
  })).max(15),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  return NextResponse.json({ workspace: await getMemberWorkspace(user.id) });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const parsed = workspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid workspace data.");
  const { places, fixedVisitOrders } = parsed.data;
  const ids = new Set(places.map((place) => place.id));
  if (ids.size !== places.length || fixedVisitOrders.some((fixed) => !ids.has(fixed.placeId))) {
    return badRequest("Invalid place order.");
  }
  const workspace = await saveMemberWorkspace(user.id, parsed.data);
  return NextResponse.json({ workspace });
}