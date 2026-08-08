import { Baby, BedDouble, Building2, Coffee, Fuel, GraduationCap, Hospital, House, Landmark, MapPin, Pill, Popcorn, School, ShoppingBasket, SquareParking, Store, TrainFront, Utensils, type LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = { MT1: ShoppingBasket, CS2: Store, PS3: Baby, SC4: School, AC5: GraduationCap, PK6: SquareParking, OL7: Fuel, SW8: TrainFront, BK9: Landmark, CT1: Popcorn, AG2: House, PO3: Building2, AT4: Landmark, AD5: BedDouble, FD6: Utensils, CE7: Coffee, HP8: Hospital, PM9: Pill };
const CATEGORY_COLORS: Record<string, string> = { MT1: "#e0af5c", CS2: "#76a9e8", PS3: "#e88cab", SC4: "#a98fdc", AC5: "#93a2e1", PK6: "#8da5bd", OL7: "#e4a36d", SW8: "#72b7aa", BK9: "#aa92d6", CT1: "#de90af", AG2: "#91a9bf", PO3: "#76a9e8", AT4: "#e0af5c", AD5: "#9c93db", FD6: "#e68791", CE7: "#c5a167", HP8: "#e78b97", PM9: "#78b88b" };

export const getPlaceCategoryColor = (code?: string) => CATEGORY_COLORS[code ?? ""] ?? "#76a9e8";

export function PlaceCategoryIcon({ code, size = 18, className, color }: { code?: string; size?: number; className?: string; color?: string }) {
  const Icon = CATEGORY_ICONS[code ?? ""] ?? MapPin;
  return <Icon className={className} style={{ color: color ?? getPlaceCategoryColor(code) }} size={size} aria-hidden="true" />;
}
