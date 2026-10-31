import { Nav } from "@/components/Nav";
import { ScoutClient, type Pin } from "@/components/ScoutClient";
import { cacheCounts, placeProspects } from "@/lib/overpass";
import { ILLINOIS } from "@/lib/places";
import { getPlace, CHICAGO } from "@/lib/places";
import { isOperatorNow } from "@/lib/auth";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ScoutPage({ searchParams }: { searchParams: Promise<{ place?: string; view?: string; tab?: string }> }) {
  const { place: slug, view, tab } = await searchParams;
  const v = (view ?? "").split(",").map(Number);
  const initialView = v.length === 3 && v.every(Number.isFinite) ? { lat: v[0], lon: v[1], zoom: v[2] } : undefined;
  const place = (await getPlace(slug ?? "chicago")) ?? CHICAGO;
  const { list, machines } = await placeProspects(place.slug);
  const st = await readState();
  const counts = await cacheCounts(place.slug);
  const cities = await Promise.all(ILLINOIS.map(async (c) => ({ slug: c.slug, name: c.name.replace(", Illinois", "").replace(", United States", ""), scanned: Object.values(await cacheCounts(c.slug)).some((n) => n !== null) })));
  const pins: Pin[] = list.slice(0, 1500).map(({ prospect: p }) => ({
    id: p.id, name: p.name, area: p.area, lat: p.lat, lon: p.lon, category: p.category, score: p.score, late: p.late, site: !!p.tags.website,
  }));
  const top20 = list.slice(0, 20).filter((x) => x.prospect.tags.website).map((x) => x.prospect.id);
  const ours = st.machines.filter((m) => m.lat !== undefined).map((m) => ({ lat: m.lat!, lon: m.lon! }));
  return (
    <>
      <Nav on="scout" />
      <ScoutClient key={place.slug} place={{ slug: place.slug, name: place.name }} bbox={place.bbox} pins={pins} existing={machines} ours={ours} total={list.length} top20={top20} initialView={initialView} initialTab={tab === "list" ? "list" : "map"} cities={cities} hasData={Object.values(counts).some((c) => c !== null)} operator={await isOperatorNow()} />
    </>
  );
}
