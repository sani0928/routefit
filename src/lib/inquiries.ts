import { AppError } from "@/lib/errors";
import type { InquiryRequest } from "@/lib/validation/inquiry.schema";

const INQUIRY_RECIPIENT = "kksan12@gmail.com";

type InquiryEmailInput = {
  senderName: string;
  authenticated: boolean;
  replyEmail: string | null;
  request: InquiryRequest;
  receivedAt?: Date;
};

const formatKoreanDateTime = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const formatDistance = (meters: number) => meters >= 1_000 ? `${(meters / 1_000).toFixed(1)}km` : `${Math.round(meters)}m`;
const formatDuration = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
};
const safeSubjectName = (name: string) => name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "비회원";

export function buildInquiryEmail({ senderName, authenticated, replyEmail, request, receivedAt = new Date() }: InquiryEmailInput) {
  const replyDetails = replyEmail ?? "회신 이메일 없음 (사용자가 이메일 없이 문의하기를 선택함)";
  const { summary } = request;
  return {
    to: INQUIRY_RECIPIENT,
    subject: `[RouteFit] ${safeSubjectName(senderName)}님의 문의 내용입니다.`,
    text: [
      "[ RouteFit 문의 접수 ]",
      `접수 시각: ${formatKoreanDateTime(receivedAt)} (KST)`,
      `로그인 상태: ${authenticated ? "로그인 회원" : "비회원"}`,
      `회신 이메일: ${replyDetails}`,
      "",
      "[ 계산 요약 ]",
      `방문 장소: ${summary.placeCount}곳`,
      `총 이동 거리: ${formatDistance(summary.totalDistanceMeters)}`,
      `예상 소요 시간: ${formatDuration(summary.totalDurationMilliseconds)}`,
      `예상 통행료: ${Math.round(summary.totalTollFare).toLocaleString("ko-KR")}원`,
      "",
      "[ 문의 내용 ]",
      request.message,
    ].join("\n"),
  };
}

export async function sendInquiryEmail(input: InquiryEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new AppError("문의 메일 설정이 완료되지 않았습니다.", 503, "INQUIRY_EMAIL_NOT_CONFIGURED");

  const email = buildInquiryEmail(input);
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
    });
  } catch {
    throw new AppError("문의 이메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502, "INQUIRY_EMAIL_DELIVERY_FAILED");
  }
  if (!response.ok) {
    console.error("[RouteFit] Inquiry email delivery failed", response.status);
    throw new AppError("문의 이메일을 발송하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502, "INQUIRY_EMAIL_DELIVERY_FAILED");
  }
}
