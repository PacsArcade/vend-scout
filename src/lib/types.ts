export type Category = "laundry" | "gym" | "car_wash" | "car_repair" | "vending" | "convenience" | "fast_food";
export type VenueCategory = "laundry" | "gym" | "car_wash" | "car_repair";
export const VENUE_CATEGORIES: VenueCategory[] = ["laundry", "gym", "car_wash", "car_repair"];
export const ALL_CATEGORIES: Category[] = ["laundry", "gym", "car_wash", "car_repair", "vending", "convenience", "fast_food"];
export const CATEGORY_LABEL: Record<VenueCategory, string> = {
  laundry: "Laundromat",
  gym: "Gym",
  car_wash: "Car wash",
  car_repair: "Auto shop",
};
export const CATEGORY_PLURAL: Record<VenueCategory, string> = {
  laundry: "laundromats",
  gym: "gyms",
  car_wash: "car washes",
  car_repair: "auto shops",
};
export const STAGES = ["Found", "Visited", "Pitched", "Yes", "Placed"] as const;
export type Stage = (typeof STAGES)[number];

export interface Bbox { south: number; west: number; north: number; east: number }
export interface Place { slug: string; name: string; bbox: Bbox }

export interface PlaceInput {
  category: VenueCategory;
  openingHours?: string;
  hasName: boolean;
  hasAddress: boolean;
  nearestMachineM: number | null;
  sameNear: number; // other venues of the same kind within 400 m
  foodLateNear: number; // late food and convenience shops within 400 m (unknown hours count half)
}
export interface Factor { key: string; label: string; value: number; weight: number; note: string }
export interface Scored { score: number; factors: Factor[] }

export interface OsmContactTags { phone?: string; email?: string; website?: string; facebook?: string; instagram?: string }
export interface Prospect {
  id: string;
  name: string;
  area: string;
  lat: number;
  lon: number;
  category: VenueCategory;
  openingHours?: string;
  placeSlug: string;
  tags: OsmContactTags;
}
export type ScoredProspect = Prospect & { score: number; late: boolean; stage?: Stage };

export interface Note { date: string; h?: number; text: string }
export type SlotKind = "snack" | "merch" | "pickup";
export type Report = "hand" | "sensor";
export interface Slot { code: string; name: string; kind: SlotKind; level: number; priceSats: number; report?: Report }
export type Telemetry = "none" | "card" | "camera" | "sensors";
export const TELEMETRY_LABEL: Record<Telemetry, string> = { none: "None, counted by hand", card: "Card reader reports", camera: "Camera inside", sensors: "Shelf sensors" };
export interface MachineProfile {
  make: string;
  model: string;
  serial: string;
  rawCode: string; // exactly what the label scan returned
  labelPhoto?: string; // file name under data/labels
  cardReader: string; // brand, or empty
  cash: boolean;
  lightning: boolean; // Lightning board fitted
  telemetry: Telemetry;
  notes: string;
}
export const EMPTY_PROFILE: MachineProfile = { make: "", model: "", serial: "", rawCode: "", cardReader: "", cash: false, lightning: false, telemetry: "none", notes: "" };
export interface Machine {
  id: string;
  name: string;
  prospectId: string; // the place that hosts it
  hostName: string; // the prospect's name when it was placed
  hostSharePct: number;
  lat?: number;
  lon?: number;
  placedAt: string;
  h?: number;
  profile: MachineProfile;
  slots: Slot[];
}
export interface Sale { machine: string; slot: string; item: string; sats: number; at: string; h?: number; test: boolean; maker?: string }
export interface PickupOrder { code: string; item: string; priceSats: number; machine: string; slot: string; createdAt: string; h?: number; source: string }
export type PackageStatus = "drafted" | "offered" | "accepted";
export interface SitePackage { status: PackageStatus; updatedAt: string; h?: number }
export interface Contact { kind: "email" | "phone" | "website" | "facebook" | "instagram"; value: string; source: string }
export type ListingStatus = "pending" | "approved" | "declined";
export type ShelfKind = "honey" | "eggs" | "baked" | "produce" | "crafts" | "other";
export const SHELF_KINDS: ShelfKind[] = ["honey", "eggs", "baked", "produce", "crafts", "other"];
export const FOOD_KINDS: ShelfKind[] = ["honey", "eggs", "baked", "produce"];
export interface Listing {
  id: string;
  n: number;
  item: string;
  kind: ShelfKind;
  priceSats: number;
  qty: number;
  machine: string;
  pickupWindow: string;
  madeBy: string;
  status: ListingStatus;
  createdAt: string;
  h?: number;
}
export interface VoteOption { id: string; name: string; votes: number; sats: number }
