import { Nav } from "@/components/Nav";
import { ScoutClient } from "@/components/ScoutClient";
import { cacheCounts } from "@/lib/overpass";
import { buildPins } from "@/lib/pins";
import { ILLINOIS } from "@/lib/places";
import { getPlace, CHICAGO } from "@/lib/places";
import { StorageBanner } from "@/components/StorageBanner";
import { isOperatorNow } from "@/lib/auth";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ScoutPage({ searchParams }: { searchParams: Promise<{ place?: string; view?: string; tab?: string; demoDrop?: string }> }) {
  const { place: slug, view, tab, demoDrop: demo } = await searchParams;
  const v = (view ?? "").split(",").map(Number);
  const initialView = v.length === 3 && v.every(Number.isFinite) ? { lat: v[0], lon: v[1], zoom: v[2] } : undefined;
  const place = (await getPlace(slug ?? "chicago")) ?? CHICAGO;
  const { pins, machines, total, top20 } = await buildPins(place.slug);
  const st = await readState();
  const counts = await cacheCounts(place.slug);
  const cities = await Promise.all(ILLINOIS.map(async (c) => ({ slug: c.slug, name: c.name.replace(", Illinois", "").replace(", United States", ""), scanned: Object.values(await cacheCounts(c.slug)).some((n) => n !== null) })));
  const ours = st.machines.filter((m) => m.lat !== undefined).map((m) => ({ lat: m.lat!, lon: m.lon! }));
  return (
    <>
      <Nav on="scout" />
      <StorageBanner />
      <ScoutClient key={place.slug} place={{ slug: place.slug, name: place.name }} bbox={place.bbox} pins={pins} existing={machines} ours={ours} total={total} top20={top20} initialView={initialView} initialTab={tab === "list" ? "list" : "map"} cities={cities} hasData={Object.values(counts).some((c) => c !== null)} operator={await isOperatorNow()} demoDrop={process.env.VEND_DEMO_DROP === "1" && demo === "1"} />
    </>
  );
}
