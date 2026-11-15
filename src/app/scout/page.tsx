import { Nav } from "@/components/Nav";
import { ScoutClient } from "@/components/ScoutClient";
import { cacheCounts } from "@/lib/overpass";
import { buildPins } from "@/lib/pins";
import { ILLINOIS } from "@/lib/places";
import { getPlace, CHICAGO } from "@/lib/places";
import { StorageBanner } from "@/components/StorageBanner";
import { stampString } from "@/components/Bft";
import { bundleMeta, bundledCity } from "@/lib/bundled";
import { isOperatorNow } from "@/lib/auth";
import { readState } from "@/lib/store";
import { openJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function ScoutPage({ searchParams }: { searchParams: Promise<{ place?: string; view?: string; tab?: string; mode?: string; demoDrop?: string }> }) {
  const { place: slug, view, tab, mode, demoDrop: demo } = await searchParams;
  const v = (view ?? "").split(",").map(Number);
  const initialView = v.length === 3 && v.every(Number.isFinite) ? { lat: v[0], lon: v[1], zoom: v[2] } : undefined;
  const place = (await getPlace(slug ?? "chicago")) ?? CHICAGO;
  const { pins, machines, total, top20 } = await buildPins(place.slug);
  const meta = await bundleMeta();
  const fromCopy = !!meta && (await bundledCity(place.slug, "laundry") !== null);
  const copyStamp = fromCopy && meta ? await stampString(new Date(meta.extractedAt).toISOString()) : undefined;
  const st = await readState();
  const counts = await cacheCounts(place.slug);
  const cities = await Promise.all(ILLINOIS.map(async (c) => ({ slug: c.slug, name: c.name.replace(", Illinois", "").replace(", United States", ""), scanned: Object.values(await cacheCounts(c.slug)).some((n) => n !== null) })));
  const ours = st.machines.filter((m) => m.lat !== undefined && m.status === "Placed").map((m) => ({ lat: m.lat!, lon: m.lon!, btc: !!m.profile.lightning }));
  // Open jobs that have a place on the map. The machine's bitcoin flag picks the coin or the plain filled hexagon.
  const open = await openJobs(st);
  const jobs = open.jobs.filter((j) => j.lat !== undefined && j.lon !== undefined).map((j) => ({ id: j.id, kind: j.kind, title: j.title, detail: j.detail, sats: j.sats + j.bonus, lat: j.lat!, lon: j.lon!, coin: !!st.machines.find((m) => j.id.endsWith(`:${m.id}`))?.profile.lightning }));
  return (
    <>
      <Nav on="scout" />
      <StorageBanner />
      <ScoutClient key={place.slug} place={{ slug: place.slug, name: place.name }} bbox={place.bbox} pins={pins} existing={machines} ours={ours} jobs={jobs} total={total} top20={top20} initialView={initialView} initialTab={tab === "list" ? "list" : "map"} initialMode={mode === "areas" ? "areas" : "pins"} cities={cities} hasData={Object.values(counts).some((c) => c !== null)} operator={await isOperatorNow()} copyStamp={copyStamp} demoDrop={process.env.VEND_DEMO_DROP === "1" && demo === "1"} />
    </>
  );
}
