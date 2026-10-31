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
