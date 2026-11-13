// The VendFrens NIP-58 badge set. No imports, so the operator's browser can build the events to sign.
// Thresholds for service milestones come from arcade.ts (STOP_MILESTONES). On-time streaks count approved stops finished inside the worker's own block.
export const BADGE_DEFINITION_KIND = 30009; // NIP-58 badge definition, replaceable by (pubkey, d)
export const BADGE_AWARD_KIND = 8; // NIP-58 badge award

/** ONE place for the badge art. The real artwork replaces the placeholder here: set `placeholder` to false and change `base` and `ext`. */
export const BADGE_ART = { placeholder: true, base: "/badges", ext: "svg", size: "1024x1024", thumbSize: "256x256" };
export const badgeImageUrl = (d: string, origin: string) => `${origin}${BADGE_ART.base}/${d}.${BADGE_ART.ext}`;

export type BadgeGroup = "crew" | "service" | "ontime";
export interface BadgeDef { d: string; name: string; description: string; group: BadgeGroup; threshold?: number }

export const SERVICE_MILESTONES = [1, 10, 50, 100];
export const ONTIME_STREAKS = [7, 30, 100];
const ordinal = (n: number) => (n === 1 ? "1st" : n === 10 ? "10th" : n === 50 ? "50th" : n === 100 ? "100th" : `${n}th`);

export const BADGES: BadgeDef[] = [
  { d: "vendfrens-crew", name: "VendFrens Crew", description: "On the VendFrens crew: a person who keeps vending machines stocked for their neighborhood.", group: "crew" },
  ...SERVICE_MILESTONES.map((n): BadgeDef => ({ d: `vendfrens-service-${n}`, name: `${ordinal(n)} Service`, description: `Finished their ${ordinal(n)} stop or job for VendFrens, checked and approved.`, group: "service", threshold: n })),
  ...ONTIME_STREAKS.map((n): BadgeDef => ({ d: `vendfrens-ontime-${n}`, name: `${n} On Time`, description: `Finished ${n} visits in a row inside their own scheduled block.`, group: "ontime", threshold: n })),
];
export const badgeByD = (d: string) => BADGES.find((b) => b.d === d);

/** Tags of a definition event, exactly as the operator signs them. The server builds the same list to check what it is given. */
export const definitionTags = (b: BadgeDef, origin: string): string[][] => [
  ["d", b.d], ["name", b.name], ["description", b.description],
  ["image", badgeImageUrl(b.d, origin), BADGE_ART.size], ["thumb", badgeImageUrl(b.d, origin), BADGE_ART.thumbSize],
];
export const definitionUnsigned = (b: BadgeDef, origin: string, now = Date.now()) => ({ kind: BADGE_DEFINITION_KIND, created_at: Math.floor(now / 1000), tags: definitionTags(b, origin), content: "" });
export const awardAddress = (operatorHex: string, d: string) => `${BADGE_DEFINITION_KIND}:${operatorHex}:${d}`;
export const awardTags = (b: BadgeDef, operatorHex: string, recipientHex: string): string[][] => [["a", awardAddress(operatorHex, b.d)], ["p", recipientHex]];
export const awardUnsigned = (b: BadgeDef, operatorHex: string, recipientHex: string, now = Date.now()) => ({ kind: BADGE_AWARD_KIND, created_at: Math.floor(now / 1000), tags: awardTags(b, operatorHex, recipientHex), content: "" });
/** Keys for State.badgePublished. */
export const defKey = (d: string) => `def:${d}`;
export const awardKey = (d: string, hex: string) => `award:${d}:${hex}`;
