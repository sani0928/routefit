import { AppError } from "@/lib/errors";
import { naverFetch } from "./client";

interface GeocodeAddress { roadAddress?: string; jibunAddress?: string; x: string; y: string; }
interface GeocodePayload { status: string; addresses?: GeocodeAddress[]; errorMessage?: string; }
interface ReverseArea { name?: string; }
interface ReversePayload { status: { code: number }; results?: Array<{ region?: { area1?: ReverseArea; area2?: ReverseArea; area3?: ReverseArea; area4?: ReverseArea }; land?: { name?: string; number1?: string; number2?: string; addition0?: { value?: string } } }>; }

export async function geocode(query: string) {
  const payload = await naverFetch(`/map-geocode/v2/geocode?query=${encodeURIComponent(query)}&count=10`) as GeocodePayload;
  if (payload.status !== "OK") throw new AppError("주소 검색에 실패했습니다.", 502, "GEOCODE_FAILED");
  return (payload.addresses ?? []).map((address) => ({
    name: address.roadAddress || address.jibunAddress || query,
    address: address.roadAddress || address.jibunAddress || "",
    latitude: Number(address.y), longitude: Number(address.x),
  }));
}

export async function reverseGeocode(latitude: number, longitude: number) {
  const coords = `${longitude},${latitude}`;
  const payload = await naverFetch(`/map-reversegeocode/v2/gc?coords=${encodeURIComponent(coords)}&orders=roadaddr,addr&output=json`) as ReversePayload;
  if (payload.status.code !== 0) throw new AppError("좌표 주소 변환에 실패했습니다.", 502, "REVERSE_GEOCODE_FAILED");
  const result = payload.results?.[0];
  if (!result) return { address: "주소 정보 없음" };
  const region = result.region;
  const parts = [region?.area1?.name, region?.area2?.name, region?.area3?.name, region?.area4?.name, result.land?.name, result.land?.number1, result.land?.number2].filter(Boolean);
  return { address: parts.join(" ") || "주소 정보 없음" };
}
