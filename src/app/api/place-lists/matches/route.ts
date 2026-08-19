import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, getSessionUser, unauthenticated } from "@/lib/member/api";
import { getPlaceListMatchesForRoutePlaces } from "@/lib/member/repository";

const bodySchema = z.object({
  places: z.array(z.object({
    id: z.string().min(1).max(120),
    providerId: z.string().min(1).max(200).optional(),
    name: z.string().min(1).max(200),
    latitude: z.number().finite(),
    longitude: z.number().finite(),
  })).min(1).max(15),
});

/** Resolves the current workspace's saved-place context after it is restored. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return badRequest("장소 식별자가 올바르지 않습니다.");

  return NextResponse.json({ matches: await getPlaceListMatchesForRoutePlaces(user.id, body.data.places) });
}
