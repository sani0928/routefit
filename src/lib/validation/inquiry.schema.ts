import { z } from "zod";

export const inquiryRequestSchema = z.object({
  message: z.string().trim().min(10, "문의 내용은 10자 이상 입력해 주세요.").max(2_000, "문의 내용은 2,000자 이하로 입력해 주세요."),
  replyEmail: z.string().trim().email("회신 이메일 형식이 올바르지 않습니다.").max(254).optional(),
  replyOptOut: z.boolean().default(false),
  summary: z.object({
    placeCount: z.number().int().min(2).max(15),
    totalDistanceMeters: z.number().finite().min(0).max(10_000_000),
    totalDurationMilliseconds: z.number().finite().min(0).max(604_800_000),
    totalTollFare: z.number().finite().min(0).max(10_000_000),
  }),
});

export type InquiryRequest = z.infer<typeof inquiryRequestSchema>;
