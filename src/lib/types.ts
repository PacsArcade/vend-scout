export type Category = "laundry" | "gym" | "car_wash" | "car_repair" | "vending";
export const CATEGORIES: Category[] = ["laundry", "gym", "car_wash", "car_repair", "vending"];
export const CATEGORY_LABEL: Record<Category, string> = {
  laundry: "Laundromat",
  gym: "Gym",
  car_wash: "Car wash",
  car_repair: "Auto shop",
  vending: "Vending machine",
};
export const STAGES = ["Found", "Visited", "Pitched", "Yes", "Placed"] as const;
export type Stage = (typeof STAGES)[number];

export interface PlaceInput {
  category: Exclude<Category, "vending">;
  openingHours?: string;
  nearestMachineM: number | null;
}
export interface Factor {
  key: string;
  label: string;
  value: number; // 0..100
  weight: number; // 0..1
  note: string;
}
export interface Scored {
  score: number;
  factors: Factor[];
}
export interface Prospect {
  id: string;
  name: string;
  area: string;
  lat: number;
  lon: number;
  category: Exclude<Category, "vending">;
  openingHours?: string;
  nearestMachineM: number | null;
  why: string;
  stage: Stage;
  source: "demo" | "osm";
  contact?: string;
}
export interface Note { date: string; text: string }
export interface Slot { code: string; name: string; level: number; dw?: boolean; pickup?: boolean; priceSats: number }
export interface Machine {
  id: string;
  name: string;
  host: string;
  placed: string;
  nextRestock: string;
  slots: Slot[];
  today: number;
  week: number;
  btcShare: number; // percent
  hostSharePct: number;
  hostOwed: number;
  sales: { item: string; sold: number; left: number }[];
}
export interface VoteOption { id: string; name: string; votes: number; sats: number }
export interface PickupOrder { code: string; item: string; paid: string; machine: string; slot: string; heldDays: number }
