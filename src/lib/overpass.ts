import { driver, errText, readText, storageMissing, STORAGE_MISSING, writeText } from "./blobstore";
import { listPlaces } from "./places";
import { distM, scorePlace, latestClose } from "./score";
import type { ScoutCheck } from "./types";
import { bundleMeta, bundledCity, cutState, inIllinois } from "./bundled";
import type { Bbox, Category, OsmContactTags, Place, Prospect, Scored, ScoredProspect } from "./types";
import { ALL_CATEGORIES, CATEGORY_LABEL, VENUE_CATEGORIES } from "./types";

// The public server is shared and often busy. Try it first, then a second public mirror.
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const UA = "VendScout/0.2 (Pac's Arcade, pac@pacsarcade.org)";
const DAY = 24 * 60 * 60 * 1000;

const FILTER: Record<Category, string> = {
  laundry: "shop=laundry",
  gym: "leisure=fitness_centre",
  car_wash: "amenity=car_wash",
  car_repair: "shop=car_repair",
  vending: "amenity=vending_machine",
  convenience: "shop=convenience",
  fast_food: "amenity=fast_food",
};

export interface OsmElement { id: number; type: string; lat: number; lon: number; name?: string; opening_hours?: string; street?: string; tags?: OsmContactTags }
// v2 adds contact tags. A v1 file still reads, but counts as stale so the next scan refreshes it.
const SCHEMA = 2;
interface CacheFile { v?: number; fetchedAt: number; items: OsmElement[]; src?: "bundle" }

const file = (slug: string, c: Category) => `cache/${slug}/overpass-${c}.json`;

async function readStored(slug: string, c: Category): Promise<CacheFile | null> {
  try {
    return JSON.parse((await readText(file(slug, c))) ?? "") as CacheFile;
  } catch {
    return null;
  }
}
/** The saved scan for one place and kind. For the nine built-in cities our own OpenStreetMap copy (in the repo) wins when it is newer. */
export async function readCache(slug: string, c: Category): Promise<CacheFile | null> {
  const [b, k] = await Promise.all([bundledCity(slug, c), readStored(slug, c)]);
  if (b && (!k || b.fetchedAt >= k.fetchedAt)) return { v: b.v, fetchedAt: b.fetchedAt, items: b.items, src: "bundle" };
  return k;
}

type RawEl = { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type Body = { remark?: string; elements: RawEl[] };

/** One POST to Overpass with failover to the second mirror. A busy server, a timeout or a "ran out of time" remark moves on; a partial answer is never returned. */
async function postOverpass(q: string, timeoutMs: number, fetchImpl: typeof fetch = fetch, onNote?: (msg: string) => void, pauseMs = 2000, deadline = Infinity): Promise<Body> {
  let last = "OpenStreetMap did not answer";
  // Every server gets a try. If they were all busy (429 or a 5xx), wait a moment and go round once more before giving up.
  for (let round = 0; round < 2; round++) {
    let allBusy = true;
    for (let i = 0; i < ENDPOINTS.length; i++) {
      const endpoint = ENDPOINTS[i];
      const t = Math.min(timeoutMs, deadline - Date.now());
      if (t < 15_000) { last = "Out of time for this request"; throw new Error(last); }
      try {
        const res = await fetchImpl(endpoint, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(t) });
        if (!res.ok) console.error(`[vend-scan] overpass ${endpoint} answered ${res.status}`);
        const busy = res.status === 429 || res.status >= 500;
        if (busy) { last = res.status === 429 ? "The map server is busy" : "The map server had a problem"; onNote?.("The map server is busy, trying another one"); continue; }
        allBusy = false;
        if (!res.ok) { last = `The map server refused the request (${res.status})`; continue; }
        const j = (await res.json()) as Body;
        // Overpass answers 200 with a remark when the query ran out of time or memory. That result is partial, so it must not be cached.
        if (j.remark && /runtime error|timed out|out of memory/i.test(j.remark)) { last = "The map server ran out of time on this area"; onNote?.("The map server ran out of time, trying another one"); continue; }
        return j;
      } catch (e) {
        allBusy = false;
        last = (e as Error).name === "TimeoutError" ? "The map server took too long" : "Could not reach the map server";
        console.error(`[vend-scan] overpass ${endpoint} failed ${errText(e)}`);
        onNote?.("The map server did not answer, trying another one");
      }
    }
    if (round === 0 && allBusy && pauseMs >= 0) { onNote?.("Every map server is busy, trying again in a moment"); await new Promise((r) => setTimeout(r, pauseMs)); } else break;
  }
  throw new Error(last);
}

function toElement(e: RawEl): OsmElement | null {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (lat === undefined || lon === undefined) return null;
  const t = e.tags ?? {};
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const tags: OsmContactTags = {
    phone: t.phone ?? t["contact:phone"] ?? t["contact:mobile"],
    email: t.email ?? t["contact:email"],
    website: t.website ?? t["contact:website"] ?? t.url,
    facebook: t["contact:facebook"] ?? t.facebook,
    instagram: t["contact:instagram"] ?? t.instagram,
  };
  return { id: e.id, type: e.type, lat, lon, name: t.name, opening_hours: t.opening_hours, street: street || undefined, tags };
}

async function liveQuery(c: Category, b: Bbox, fetchImpl?: typeof fetch, onNote?: (msg: string) => void, pauseMs?: number, deadline?: number): Promise<OsmElement[]> {
  const body = await postOverpass(`[out:json][timeout:60];nwr[${FILTER[c]}](${b.south},${b.west},${b.north},${b.east});out center tags;`, 65_000, fetchImpl, onNote, pauseMs, deadline);
  return body.elements.map(toElement).filter((x): x is OsmElement => x !== null);
}

/** Order the seven categories land in: the places we pitch first, then the context that scores them. */
export const LAND_ORDER: Category[] = ["laundry", "gym", "car_wash", "car_repair", "vending", "convenience", "fast_food"];

/** Which categories a raw OSM element belongs to. An element can belong to more than one. */
export function categoriesOf(tags: Record<string, string> | undefined): Category[] {
  const t = tags ?? {};
  return LAND_ORDER.filter((c) => { const [k, v] = FILTER[c].split("="); return t[k] === v; });
}
/** Split one union answer into the per-category lists, exactly as seven separate queries would have returned them. */
export function splitUnion(elements: RawEl[]): Record<Category, OsmElement[]> {
  const out = Object.fromEntries(LAND_ORDER.map((c) => [c, [] as OsmElement[]])) as Record<Category, OsmElement[]>;
  for (const e of elements) {
    const el = toElement(e);
    if (!el) continue;
    for (const c of categoriesOf(e.tags)) out[c].push(el);
  }
  return out;
}
export const unionQueryText = (b: Bbox) => `[out:json][timeout:125];(${LAND_ORDER.map((c) => `nwr[${FILTER[c]}](${b.south},${b.west},${b.north},${b.east});`).join("")});out center tags;`;

let extractMs = 0; // when our own copy was extracted (0 = no copy)
const loadMeta = async () => { extractMs = (await bundleMeta())?.extractedAt ?? 0; };
/** Fresh = under a day old, or taken from our own copy and not older than the copy we have now. */
const isFresh = (c: CacheFile | null) => !!c && (c.v ?? 1) >= SCHEMA && (c.src === "bundle" ? c.fetchedAt >= extractMs : Date.now() - c.fetchedAt < DAY);
/** True when all seven caches for a place are under a day old. */
export async function placeIsFresh(slug: string): Promise<boolean> {
  await loadMeta();
  for (const c of LAND_ORDER) if (!isFresh(await readCache(slug, c))) return false;
  return true;
}
/** The oldest fetch time across a place's caches (0 when any is missing). Used to scan the stalest city first. */
export async function placeAge(slug: string): Promise<number> {
  let oldest = Infinity;
  for (const c of LAND_ORDER) { const k = await readCache(slug, c); if (!k) return 0; oldest = Math.min(oldest, k.fetchedAt); }
  return oldest;
}

export interface ScanResult { ok: boolean; skipped: boolean; usedUnion: boolean; failed: Category[]; error?: string; errors: string[]; source?: "bundle" | "overpass"; extractedAt?: number }
/**
 * Scan one place. One union query for all seven categories, split on our side and saved into the per-category caches.
 * If the union query fails or times out, fall back to the per-category queries. Categories that are still fresh are not asked again
 * (one live query per category per day). onCategory fires as each category lands, so the screen can fill in as it goes.
 * A failed WRITE is never hidden: it is logged, counted as failed, and its text is returned in errors.
 */
export async function scanPlace(place: Place, opts: { onCategory?: (c: Category, count: number) => void | Promise<void>; onNote?: (msg: string) => void; fetchImpl?: typeof fetch; force?: boolean; pauseMs?: number; budgetMs?: number; dropMs?: number } = {}): Promise<ScanResult> {
  const deadline = Date.now() + (opts.budgetMs ?? 270_000);
  await loadMeta();
  // 1. Our own OpenStreetMap copy: instant, no network. The nine built-in cities read straight from the repo; another Illinois place is cut from the statewide files.
  const fromCopy = await scanFromCopy(place, opts);
  if (fromCopy) return fromCopy;
  // 2. Anywhere else (or no copy built yet): Overpass, which needs somewhere to save the answer.
  if (storageMissing()) { console.error("[vend-scan] refused: storage is not connected"); return { ok: false, skipped: false, usedUnion: false, failed: [...LAND_ORDER], errors: [STORAGE_MISSING], error: STORAGE_MISSING }; }
  const stale: Category[] = [];
  for (const c of LAND_ORDER) if (opts.force || !isFresh(await readCache(place.slug, c))) stale.push(c);
  if (stale.length === 0) return { ok: true, skipped: true, usedUnion: false, failed: [], errors: [] };
  const errors: string[] = [], failed: Category[] = [];
  const save = async (c: Category, items: OsmElement[]) => {
    try {
      await writeText(file(place.slug, c), JSON.stringify({ v: SCHEMA, fetchedAt: Date.now(), items } satisfies CacheFile));
      console.info(`[vend-scan] wrote ${file(place.slug, c)} ${items.length} items driver=${driver()}`);
    } catch (e) {
      console.error(`[vend-scan] could not save ${c} for ${place.slug} ${errText(e)}`);
      failed.push(c); errors.push(`${c}: ${errText(e)}`);
      return;
    }
    await opts.onCategory?.(c, items.length);
  };
  let split: Record<Category, OsmElement[]> | null = null;
  try {
    split = splitUnion((await postOverpass(unionQueryText(place.bbox), 130_000, opts.fetchImpl, opts.onNote, opts.pauseMs, deadline - 60_000)).elements); // keep a minute in hand for the per-kind fallback
  } catch (e) {
    console.error(`[vend-scan] union query for ${place.slug} failed on every server, trying one kind at a time: ${errText(e)}`);
    opts.onNote?.("The one-shot query failed on every server. Asking one kind at a time.");
  }
  if (split) {
    for (const c of LAND_ORDER) if (stale.includes(c)) await save(c, split[c]);
    return { ok: failed.length === 0, skipped: false, usedUnion: true, failed, errors, error: errors[0] };
  }
  for (const c of LAND_ORDER) {
    if (!stale.includes(c)) continue;
    if (deadline - Date.now() < 45_000) { failed.push(c); errors.push(`${c}: Out of time for this request. Press Scan again to continue; kinds already saved are kept.`); continue; }
    let items: OsmElement[];
    try { items = await liveQuery(c, place.bbox, opts.fetchImpl, opts.onNote, opts.pauseMs, deadline); } catch (e) { console.error(`[vend-scan] ${c} for ${place.slug} failed ${errText(e)}`); failed.push(c); errors.push(`${c}: ${errText(e)}`); continue; }
    await save(c, items);
  }
  return { ok: failed.length === 0, skipped: false, usedUnion: false, failed, errors, error: errors[0] };
}

async function scanFromCopy(place: Place, opts: { onCategory?: (c: Category, count: number) => void | Promise<void>; dropMs?: number }): Promise<ScanResult | null> {
  const meta = await bundleMeta();
  if (!meta) return null;
  const builtIn = !!(await bundledCity(place.slug, "laundry"));
  if (!builtIn && !inIllinois(place.bbox)) return null;
  if (!builtIn && !(await cutState("laundry", place.bbox))) return null;
  if (!builtIn && storageMissing()) return { ok: false, skipped: false, usedUnion: false, failed: [...LAND_ORDER], errors: [STORAGE_MISSING], error: STORAGE_MISSING, source: "bundle", extractedAt: meta.extractedAt };
  const failed: Category[] = [], errors: string[] = [];
  for (const c of LAND_ORDER) {
    let items: OsmElement[];
    if (builtIn) items = (await bundledCity(place.slug, c))?.items ?? [];
    else {
      items = (await cutState(c, place.bbox)) ?? [];
      try { await writeText(file(place.slug, c), JSON.stringify({ v: SCHEMA, fetchedAt: meta.extractedAt, items, src: "bundle" } satisfies CacheFile)); }
      catch (e) { console.error(`[vend-scan] could not save ${c} for ${place.slug} ${errText(e)}`); failed.push(c); errors.push(`${c}: ${errText(e)}`); continue; }
    }
    console.info(`[vend-scan] ${place.slug} ${c} ${items.length} items from our own copy`);
    await opts.onCategory?.(c, items.length);
    if ((opts.dropMs ?? 140) > 0) await new Promise((r) => setTimeout(r, opts.dropMs ?? 140)); // a beat between kinds, so the loader shows each one landing
  }
  return { ok: failed.length === 0, skipped: false, usedUnion: false, failed, errors, error: errors[0], source: "bundle", extractedAt: meta.extractedAt };
}

/** Cached items. Goes live only when allowed and the cache is missing or older than a day (one live query per category per day). */
export async function getCategory(place: Place, c: Category, allowLive: boolean) {
  await loadMeta();
  const cached = await readCache(place.slug, c);
  const fresh = isFresh(cached);
  if (fresh || !allowLive) return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false, error: undefined as string | undefined };
  try {
    const items = await liveQuery(c, place.bbox);
    const data: CacheFile = { v: SCHEMA, fetchedAt: Date.now(), items };
    await writeText(file(place.slug, c), JSON.stringify(data));
    console.info(`[vend-scan] wrote ${file(place.slug, c)} ${items.length} items driver=${driver()}`);
    return { items, fetchedAt: data.fetchedAt, live: true, error: undefined as string | undefined };
  } catch (e) {
    console.error(`[vend-scan] ${c} for ${place.slug} failed ${errText(e)}`);
    return { items: cached?.items ?? [], fetchedAt: cached?.fetchedAt ?? null, live: false, error: errText(e) };
  }
}

export async function cacheCounts(slug: string) {
  const out: Record<string, number | null> = {};
  for (const c of ALL_CATEGORIES) out[c] = (await readCache(slug, c))?.items.length ?? null;
  return out;
}

export interface Detailed { prospect: ScoredProspect; scored: Scored }

export async function placeProspects(slug: string, checks: Record<string, ScoutCheck> = {}): Promise<{ list: Detailed[]; machines: { lat: number; lon: number }[] }> {
  const read = async (c: Category) => (await readCache(slug, c))?.items ?? [];
  const machines = await read("vending");
  const food = [...(await read("convenience")), ...(await read("fast_food"))];
  const venues = new Map<string, OsmElement[]>();
  for (const c of VENUE_CATEGORIES) venues.set(c, await read(c));
  const list: Detailed[] = [];
  for (const c of VENUE_CATEGORIES) {
    const items = venues.get(c) ?? [];
    for (const e of items) {
      const pt: [number, number] = [e.lat, e.lon];
      let nearest: number | null = null;
      for (const m of machines) {
        const d = distM(pt, [m.lat, m.lon]);
        if (nearest === null || d < nearest) nearest = d;
      }
      let same = 0;
      for (const o of items) if (o !== e && Math.abs(o.lat - e.lat) < 0.005 && distM(pt, [o.lat, o.lon]) <= 400) same++;
      let foodLate = 0;
      for (const f of food) {
        if (Math.abs(f.lat - e.lat) > 0.005) continue;
        if (distM(pt, [f.lat, f.lon]) > 400) continue;
        const close = latestClose(f.opening_hours);
        foodLate += close === null ? 0.5 : close >= 22 * 60 ? 1 : 0;
      }
      const chk = checks[`osm-${e.type[0]}${e.id}`];
      const scored = scorePlace({ scout: chk ? { inside: chk.inside, state: chk.state, room: chk.room, stamp: chk.stamp ?? chk.at } : undefined, category: c, openingHours: e.opening_hours, hasName: !!e.name, hasAddress: !!e.street, nearestMachineM: nearest, sameNear: same, foodLateNear: foodLate });
      const p: Prospect = {
        id: `osm-${e.type[0]}${e.id}`,
        name: e.name ?? `${CATEGORY_LABEL[c]} (unnamed)`,
        area: e.street ?? "No address on the map",
        lat: e.lat, lon: e.lon, category: c, openingHours: e.opening_hours, placeSlug: slug, tags: e.tags ?? {},
      };
      const late = (latestClose(e.opening_hours) ?? 0) >= 22 * 60;
      list.push({ prospect: { ...p, score: scored.score, late }, scored });
    }
  }
  list.sort((a, b) => b.prospect.score - a.prospect.score);
  return { list, machines };
}

export async function findProspect(id: string, checks: Record<string, ScoutCheck> = {}): Promise<Detailed | null> {
  for (const pl of await listPlaces()) {
    const { list } = await placeProspects(pl.slug, checks);
    const hit = list.find((x) => x.prospect.id === id);
    if (hit) return hit;
  }
  return null;
}
