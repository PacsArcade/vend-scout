// Gig settings. Test values. Edit here. Modeled on what DoorDash and Dasher help pages describe:
// pay shown before you accept, a bonus in busy zones, first look for new workers, scheduled blocks.
export const GIG = {
  cellDeg: 0.03, // a busy "zone" is a grid cell about 3 km wide
  busyMinJobs: 3, // open jobs in one zone before the bonus shows
  busyBonusSats: 1000, // test value
  welcomeJobs: 10, // a new worker's first jobs
  welcomeKm: 5, // first look on offers this close to a new worker
  blockKm: 25, // a scheduled block covers jobs this close to its city
  firstLookMs: 3 * 60_000, // how long priority workers see an offer alone
  startHours: [1, 2, 3, 4, 6, 12, 24, 36, 48],
  lengthHours: [2, 3, 4, 6],
};
export const zoneKey = (lat: number, lon: number) => `${Math.floor(lat / GIG.cellDeg)}:${Math.floor(lon / GIG.cellDeg)}`;

// ARCADE SCORE. Our own design. TEST values. Edit here.
// RULE: points are NEVER given for driving speed or the time between stops. Not now, not as a "bonus", not in a streak.
// Safety first. The crew copy says it: "We never score speed. Drive safe."
export const ARCADE = {
  stop: 100, // every approved stop
  fullFill: 300, // every slot on the load list stocked
  cleanGlass: 150, // the glass photo shows clean glass (the checker confirms)
  beforeSellOut: 200, // stocked while no slot had run empty
  localDelivered: 250, // a local shelf item delivered
  inBlock: 150, // finished inside the worker's own scheduled block
  streakStep: 20, // per extra day in a row, up to streakMaxDays
  streakMaxDays: 6,
  comboMultiplier: 1.5, // a whole route approved with no retakes
};
export const SPEED_SCORING = false as const; // never turn this on
export const NEVER_SPEED_LINE = "We never score speed. Drive safe.";
export const LEVELS = [
  { at: 0, name: "Rookie" },
  { at: 500, name: "Regular" },
  { at: 1500, name: "Pro" },
  { at: 4000, name: "Ace" },
  { at: 9000, name: "Legend" },
];
// Points could unlock a sats bonus tier later. TEST values, not paid out yet.
export const BONUS_TIERS_TEST = [
  { minPoints: 1500, bonusSats: 500, test: true },
  { minPoints: 4000, bonusSats: 1500, test: true },
  { minPoints: 9000, bonusSats: 3000, test: true },
];
