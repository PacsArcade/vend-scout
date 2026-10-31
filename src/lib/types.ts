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
export interface Slot { code: string; name: string; kind: SlotKind; level: number; priceSats: number; report?: Report; itemId?: string }
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
export type MachineStatus = "In storage" | "Placed" | "In repair" | "Retired";
export const MACHINE_STATUSES: MachineStatus[] = ["In storage", "Placed", "In repair", "Retired"];
export type MachineType = "snack" | "drinks" | "combo" | "fresh" | "coffee" | "cards" | "art" | "lockers" | "claw" | "other";
export const MACHINE_TYPES: MachineType[] = ["snack", "drinks", "combo", "fresh", "coffee", "cards", "art", "lockers", "claw", "other"];
export interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
  type: MachineType;
  typeOther?: string; // free text when type is "other"
  prospectId: string; // the place that hosts it. Empty text while the machine is not placed.
  hostName: string; // the prospect's name when it was placed. Empty while not placed.
  hostSharePct: number;
  lat?: number;
  lon?: number;
  placedAt: string;
  h?: number;
  profile: MachineProfile;
  slots: Slot[];
  addedAt?: string;
  restockRequested?: boolean;
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
  lightning: string; // the maker's Lightning address or LNURL. No account, no keys.
  status: ListingStatus;
  createdAt: string;
  h?: number;
}
export interface VoteOption { id: string; name: string; votes: number; sats: number }

// ---- Crew ----
export type CrewRole = "runner" | "scout" | "keeper" | "tech";
export const CREW_ROLES: CrewRole[] = ["runner", "scout", "keeper", "tech"];
export const APPLICANT_STAGES = ["Applied", "Chatted", "Ride-along", "On the crew", "Not now"] as const;
export type ApplicantStage = (typeof APPLICANT_STAGES)[number];
export const TRANSPORT = ["car", "bike", "transit", "on foot"] as const;
export interface StepNote { stage: ApplicantStage; text: string; date: string; h?: number }
export interface Applicant {
  id: string;
  name: string;
  reach: string; // email or phone, as they typed it
  area: string;
  lat?: number;
  lon?: number;
  roles: CrewRole[];
  transport: string[];
  hours: string;
  why: string;
  lightning?: string;
  stage: ApplicantStage;
  npub?: string; // linked nostr key, for crew sign-in
  leaderboard?: boolean; // opt-in. Default off.
  notes: StepNote[];
  createdAt: string;
  h?: number;
}
export type OutreachHow = "email" | "call" | "visit" | "DM";
export const OUTREACH_HOW: OutreachHow[] = ["email", "call", "visit", "DM"];
export const OUTREACH_OUTCOME = ["No answer", "Talked", "Interested", "Not interested", "Said yes"] as const;
export interface Outreach { who: string; how: OutreachHow; outcome: string; note: string; date: string; h?: number }
export interface StopDone { machine: string; at: string; h?: number; photo?: string }
export interface Route { id: string; name: string; runner?: string; stops: string[]; done: StopDone[]; createdAt: string; h?: number }

export type JobKind = "restock" | "scout" | "shelf" | "tech";
export interface Claim { bonus?: number; paidSats?: number; job: string; kind: JobKind; title: string; sats: number; by: string; at: string; h?: number; doneAt?: string; doneH?: number; photo?: string }
export interface HostPick { types: MachineType[]; other: string; note: string; date: string; h?: number }

export interface Block { id: string; by: string; city: string; cityName: string; startAt: string; endAt: string; h?: number }
export interface PayoutRec { by: string; sats: number; reason: string; at: string; h?: number; job?: string; sent: boolean }

// ---- Proof and points ----
export type ProofStatus = "sent" | "retake" | "approved";
export interface ProofEvent { status: ProofStatus; at: string; h?: number; note?: string }
export interface Proof {
  id: string;
  kind: "job" | "stop";
  ref: string; // the job id, or route:<route>:<machine> for a stop
  route?: string;
  machine?: string;
  by: string;
  before: string; // photo file: glass before
  after: string; // photo file: glass after
  ticked: string[]; // slot codes ticked on the load list
  loadTotal: number; // how many slots were on the load list
  soldOutAtVisit: boolean; // any slot already empty when the proof came in
  jobKind: JobKind;
  status: ProofStatus;
  reason?: string; // why a retake was asked
  history: ProofEvent[];
  sentAt: string;
  loadItems?: { slot: string; item: string; ref?: string }[];
  ai?: AiVerdict;
  paidSats?: number;
  points?: number;
  breakdown?: { label: string; points: number }[];
  popSeen?: boolean;
  approvedAt?: string;
  approvedH?: number;
}

// ---- Item catalog and the AI photo checker (shadow mode) ----
export interface Item { id: string; name: string; size: string; photo?: string; priceSats: number }
export type Tri = "yes" | "no" | "unsure";
export interface AiSlot { slot: string; expected_item: string; looks_stocked: Tri; matches_item: Tri }
export interface AiVerdict {
  overall: "pass" | "needs-human";
  glassClean: Tri; loadMatches: Tri;
  slots: AiSlot[]; reasons: string[];
  model: string; ms: number; at: string; error?: string;
}
export interface LoadItem2 { slot: string; item: string; ref?: string }
export interface AiLogEntry { proof: string; at: string; h?: number; aiOverall: "pass" | "needs-human"; aiGlass: Tri; aiLoad: Tri; humanDecision: "approve" | "retake"; humanGlass: boolean; humanLoad: boolean; agree: boolean; before: string; after: string; title: string }
