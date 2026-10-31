import type { Place } from "./types";

export interface CronDeps {
  places: Place[];
  isFresh: (slug: string) => Promise<boolean>;
  ageOf: (slug: string) => Promise<number>;
  scan: (p: Place) => Promise<{ ok: boolean; failed: string[]; usedUnion: boolean }>;
  now: () => number;
  budgetMs: number; // total time this run may take
  perCityMs: number; // time one city is allowed to need, to decide whether to start it
}
export interface CronSummary { scanned: string[]; skippedFresh: string[]; deferred: string[]; failed: string[] }

/**
 * The daily scan-ahead. Cities whose caches are all under a day old are skipped (never more than once a day per city).
 * The rest go oldest first, round robin across days: a city is only started if there is time left for it,
 * and the ones that did not fit are first in line tomorrow because they are still the oldest.
 */
export async function runDailyScan(d: CronDeps): Promise<CronSummary> {
  const start = d.now();
  const out: CronSummary = { scanned: [], skippedFresh: [], deferred: [], failed: [] };
  const due: { p: Place; age: number }[] = [];
  for (const p of d.places) {
    if (await d.isFresh(p.slug)) out.skippedFresh.push(p.slug);
    else due.push({ p, age: await d.ageOf(p.slug) });
  }
  due.sort((a, b) => a.age - b.age); // oldest first (never scanned = 0 = first)
  for (const { p } of due) {
    if (d.now() - start + d.perCityMs > d.budgetMs) { out.deferred.push(p.slug); continue; }
    try {
      const r = await d.scan(p);
      (r.ok ? out.scanned : out.failed).push(p.slug);
    } catch { out.failed.push(p.slug); }
  }
  return out;
}

/**
 * The cities that come from our own OpenStreetMap copy (the repo) never need the daily scan. Only the other places people searched for do,
 * and an Illinois one among those is cut from the copy, which is quick. When there are none, the cron has nothing to do.
 */
export function cronPlaces(all: Place[], builtInSlugs: string[]): Place[] {
  const skip = new Set(builtInSlugs);
  return all.filter((p) => !skip.has(p.slug));
}
