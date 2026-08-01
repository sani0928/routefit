import { AppError } from "@/lib/errors";

const BASE_URL = "https://maps.apigw.ntruss.com";

function credentials(): HeadersInit {
  const id = process.env.NAVER_MAP_API_KEY_ID;
  const secret = process.env.NAVER_MAP_API_KEY_SECRET;
  if (!id || !secret) throw new AppError("NAVER 서버 API 키가 설정되지 않았습니다.", 503, "MAPS_NOT_CONFIGURED");
  return { "Accept": "application/json", "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret };
}

export async function naverFetch(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: credentials(),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new AppError("지도 서비스 응답 시간이 초과되었습니다.", 504, "MAPS_TIMEOUT");
    throw new AppError("지도 서비스에 연결하지 못했습니다.", 502, "MAPS_NETWORK_ERROR");
  }
  if (response.status === 401 || response.status === 403) throw new AppError(`NAVER API 인증에 실패했습니다. (원본 상태: ${response.status})`, 502, "MAPS_AUTH_ERROR");
  if (response.status === 429) throw new AppError("NAVER API 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.", 503, "MAPS_RATE_LIMIT");
  if (!response.ok) throw new AppError("지도 서비스가 요청을 처리하지 못했습니다.", 502, "MAPS_UPSTREAM_ERROR");
  return response.json();
}
