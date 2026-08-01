import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { drivingRoute } from "@/lib/naver-maps/directions";
import { routeCostSchema } from "@/lib/validation/route.schema";

export async function POST(request: NextRequest) {
  try {
    const body = routeCostSchema.parse(await request.json());
    const [origin, destination] = [body.origin, body.destination].map((p, index) => ({ ...p, id: String(index), name: "지점", type: "WAYPOINT" as const }));
    return NextResponse.json(await drivingRoute(origin, destination));
  } catch (error) { return apiError(error); }
}
