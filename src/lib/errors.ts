import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) { super(message); }
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "입력값이 올바르지 않습니다." } }, { status: 400 });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("Unexpected API error", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." } }, { status: 500 });
}
