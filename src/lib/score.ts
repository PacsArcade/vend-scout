import type { Factor, PlaceInput, Scored } from "./types";

const VENUE_WEIGHT: Record<PlaceInput["category"], number> = {
  laundry: 95, // people wait 45 minutes a load
  gym: 85,
  car_repair: 80, // long waits
  car_wash: 75,
};
const VENUE_NOTE: Record<PlaceInput["category"], string> = {
  laundry: "People wait out a load",
  gym: "Members wait between sets",
  car_repair: "Customers wait 1 to 3 hours",
  car_wash: "Short stays, late hours",
};

/** Parse OSM opening_hours loosely. Returns 0..100 and a plain note. */
export function openLateValue(hours?: string): { value: number; note: string } {
  if (!hours) return { value: 40, note: "Hours not known" };
  const h = hours.trim();
  if (/24\s*\/\s*7/.test(h)) return { value: 100, note: "Open 24 hours" };
  let latest = -1;
  for (const m of h.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)) {
    const start = +m[1] * 60 + +m[2];
    let end = +m[3] * 60 + +m[4];
    if (end <= start) end += 24 * 60; // runs past midnight
    latest = Math.max(latest, end);
  }
  if (latest < 0) return { value: 40, note: "Hours not known" };
  if (latest >= 24 * 60) return { value: 100, note: "Open past midnight" };
  if (latest >= 22 * 60) return { value: 85, note: "Open after 10 PM" };
  if (latest >= 20 * 60) return { value: 45, note: "Closes before 10 PM" };
  return { value: 15, note: "Closes early" };
}

/** Distance to the nearest existing machine: 0 m is 0, 600 m or more is 100. */
export function noMachineValue(distanceM: number | null): { value: number; note: string } {
  if (distanceM === null) return { value: 100, note: "No machine found nearby" };
  const value = Math.round(Math.min(100, Math.max(0, (distanceM / 600) * 100)));
  return { value, note: `Nearest machine ${Math.round(distanceM)} m away` };
}

export function scorePlace(p: PlaceInput): Scored {
  const late = openLateValue(p.openingHours);
  const nm = noMachineValue(p.nearestMachineM);
  const factors: Factor[] = [
    { key: "venue", label: "Venue type", value: VENUE_WEIGHT[p.category], weight: 0.4, note: VENUE_NOTE[p.category] },
    { key: "late", label: "Open late", value: late.value, weight: 0.25, note: late.note },
    { key: "machine", label: "No machine nearby", value: nm.value, weight: 0.35, note: nm.note },
  ];
  const score = Math.round(factors.reduce((a, f) => a + f.value * f.weight, 0));
  return { score, factors };
}

export function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
