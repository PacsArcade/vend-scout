import type { Factor, PlaceInput, Scored, VenueCategory } from "./types";
import { CATEGORY_PLURAL } from "./types";

const VENUE_WEIGHT: Record<VenueCategory, number> = { laundry: 95, gym: 85, car_repair: 75, car_wash: 70 };
const VENUE_NOTE: Record<VenueCategory, string> = {
  laundry: "People wait out a load",
  gym: "Members wait between sets",
  car_repair: "Customers wait 1 to 3 hours",
  car_wash: "Short stays",
};

export const WEIGHTS = { venue: 0.2, late: 0.2, machine: 0.2, density: 0.1, food: 0.2, complete: 0.1 } as const;

/** Latest closing time in minutes from midnight (can pass 1440), or null when the hours are not usable. */
export function latestClose(hours?: string): number | null {
  if (!hours) return null;
  const h = hours.trim();
  if (/24\s*\/\s*7/.test(h)) return 24 * 60 + 1;
  let latest = -1;
  for (const m of h.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)) {
    const start = +m[1] * 60 + +m[2];
    let end = +m[3] * 60 + +m[4];
    if (end <= start) end += 24 * 60;
    latest = Math.max(latest, end);
  }
  return latest < 0 ? null : latest;
}

/** Hours must be on the map to earn credit. Unknown hours earn nothing. */
export function openLateValue(hours?: string): { value: number; note: string } {
  const c = latestClose(hours);
  if (c === null) return { value: 0, note: "Hours are not on the map, so no credit" };
  if (c > 24 * 60) return { value: 100, note: "Open 24 hours" };
  if (c >= 24 * 60) return { value: 100, note: "Open until midnight or later" };
  if (c >= 22 * 60) return { value: 80, note: "Open after 10 PM" };
  if (c >= 20 * 60) return { value: 35, note: "Closes between 8 and 10 PM" };
  return { value: 10, note: "Closes before 8 PM" };
}

/** 0 m is 0, 1000 m or more is 100. */
export function noMachineValue(distanceM: number | null): { value: number; note: string } {
  if (distanceM === null) return { value: 100, note: "No vending machine in the map data" };
  const value = Math.round(Math.min(100, Math.max(0, (distanceM / 1000) * 100)));
  return { value, note: `Nearest mapped machine ${Math.round(distanceM)} m away` };
}

const INSIDE_VALUE: Record<string, number> = { none: 100, soap: 90, snacks: 25, drinks: 25, combo: 5 };
const INSIDE_NAME: Record<string, string> = { none: "no machine", soap: "soap machines only", snacks: "a snack machine", drinks: "a drink machine", combo: "a full combo machine" };
/** A scout's own look replaces the map guess. Room for another machine softens the penalty when one is already inside. */
export function scoutMachineValue(s: { inside: string; state?: string; room: string; stamp: string }): { value: number; note: string } {
  let value = INSIDE_VALUE[s.inside] ?? 100;
  const machinesInside = ["snacks", "drinks", "combo"].includes(s.inside);
  const bits = [`Scout check ${s.stamp}: ${INSIDE_NAME[s.inside] ?? s.inside} inside`];
  if (machinesInside && (s.state === "Broken" || s.state === "Empty")) { value += 20; bits.push(`it is ${s.state?.toLowerCase()}`); }
  else if (machinesInside && s.state === "Worn") { value += 10; bits.push("it is worn"); }
  if (machinesInside && s.room === "yes") { value += 35; bits.push("room for another"); }
  else if (machinesInside && s.room === "no") bits.push("no room for another");
  return { value: Math.min(100, value), note: bits.join(", ") };
}

export function densityValue(same: number, c: VenueCategory): { value: number; note: string } {
  const value = Math.max(0, 100 - same * 25);
  return { value, note: same === 0 ? `No other ${CATEGORY_PLURAL[c]} within 400 m` : `${same} other ${CATEGORY_PLURAL[c]} within 400 m` };
}

export function foodValue(n: number): { value: number; note: string } {
  const value = Math.round(100 * Math.pow(0.62, n));
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return { value, note: n === 0 ? "No late food or convenience shop within 400 m" : `About ${shown} late food or convenience shops within 400 m` };
}

export function completeValue(hasName: boolean, hours: string | undefined, hasAddress: boolean): { value: number; note: string } {
  const value = (hasName ? 40 : 0) + (latestClose(hours) !== null ? 40 : 0) + (hasAddress ? 20 : 0);
  const have = [hasName && "name", latestClose(hours) !== null && "hours", hasAddress && "address"].filter(Boolean).join(", ");
  return { value, note: have ? `Map has: ${have}` : "A bare point on the map" };
}

export function scorePlace(p: PlaceInput): Scored {
  const late = openLateValue(p.openingHours);
  const nm = p.scout ? scoutMachineValue(p.scout) : noMachineValue(p.nearestMachineM);
  const dn = densityValue(p.sameNear, p.category);
  const fd = foodValue(p.foodLateNear);
  const cp = completeValue(p.hasName, p.openingHours, p.hasAddress);
  const factors: Factor[] = [
    { key: "venue", label: "Venue type", value: VENUE_WEIGHT[p.category], weight: WEIGHTS.venue, note: VENUE_NOTE[p.category] },
    { key: "late", label: "Open late", value: late.value, weight: WEIGHTS.late, note: late.note },
    { key: "machine", label: "No machine nearby", value: nm.value, weight: WEIGHTS.machine, note: nm.note },
    { key: "density", label: "Not crowded", value: dn.value, weight: WEIGHTS.density, note: dn.note },
    { key: "food", label: "Nothing late nearby", value: fd.value, weight: WEIGHTS.food, note: fd.note },
    { key: "complete", label: "Data complete", value: cp.value, weight: WEIGHTS.complete, note: cp.note },
  ];
  const score = Math.round(factors.reduce((a, f) => a + f.value * f.weight, 0));
  return { score, factors };
}

/** Fast flat-earth distance, good to a few metres at city scale. */
export function distM(a: [number, number], b: [number, number]): number {
  const k = 111320;
  const dy = (b[0] - a[0]) * k;
  const dx = (b[1] - a[1]) * k * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

export function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
