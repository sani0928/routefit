import { describe, expect, it } from "vitest";

import { buildInquiryEmail } from "./inquiries";
import { inquiryRequestSchema } from "./validation/inquiry.schema";

const inquiry = {
  message: "계산 결과 화면에서 경로 순서를 직접 조정할 수 있으면 좋겠습니다.",
  replyEmail: "guest@example.com",
  replyOptOut: false,
  summary: {
    placeCount: 3,
    totalDistanceMeters: 12_300,
    totalDurationMilliseconds: 5_400_000,
    totalTollFare: 1_200,
  },
};

describe("inquiry request validation", () => {
  it("rejects messages shorter than 10 characters", () => {
    const result = inquiryRequestSchema.safeParse({ ...inquiry, message: "짧은 문의" });

    expect(result.success).toBe(false);
  });

  it("accepts a guest inquiry that explicitly opts out of a reply", () => {
    const result = inquiryRequestSchema.safeParse({
      ...inquiry,
      replyEmail: undefined,
      replyOptOut: true,
    });

    expect(result.success).toBe(true);
  });
});

describe("buildInquiryEmail", () => {
  it("includes only the requested summary and reply details", () => {
    const email = buildInquiryEmail({
      request: inquiry,
      receivedAt: new Date("2026-10-21T01:02:03.000Z"),
      authenticated: false,
      senderName: "비회원",
      replyEmail: inquiry.replyEmail,
    });

    expect(email.subject).toBe("[RouteFit] 비회원님의 문의 내용입니다.");
    expect(email.text).toContain("접수 시각: 2026.10.21 10:02:03 (KST)");
    expect(email.text).toContain("로그인 상태: 비회원");
    expect(email.text).toContain("회신 이메일: guest@example.com");
    expect(email.text).toContain("방문 장소: 3곳");
    expect(email.text).toContain("총 이동 거리: 12.3km");
    expect(email.text).toContain("예상 소요 시간: 1시간 30분");
    expect(email.text).toContain("예상 통행료: 1,200원");
    expect(email.text).toContain(inquiry.message);
  });
});
