import { Nav } from "@/components/Nav";
import { ScoutClient, type Pin } from "@/components/ScoutClient";
import { cacheCounts, placeProspects } from "@/lib/overpass";
import { getPlace, CHICAGO } from "@/lib/places";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ScoutPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { place: slug } = await searchParams;
  const place = (await getPlace(slug ?? "chicago")) ?? CHICAGO;
  const { list, machines } = await placeProspects(place.slug);
  const st = await readState();
  const counts = await cacheCounts(place.slug);
  const pins: Pin[] = list.slice(0, 200).map(({ prospect: p, scored }) => ({
    id: p.id, name: p.name, area: p.area, lat: p.lat, lon: p.lon, category: p.category, score: p.score, late: p.late,
    why: scored.factors.map((f) => f.note).join(". "),
  }));
  const ours = st.machines.filter((m) => m.lat !== undefined).map((m) => ({ lat: m.lat!, lon: m.lon! }));
  return (
    <>
      <Nav on="scout" />
      <ScoutClient key={place.slug} place={{ slug: place.slug, name: place.name }} bbox={place.bbox} pins={pins} existing={machines} ours={ours} total={list.length} hasData={Object.values(counts).some((c) => c !== null)} />
    </>
  );
}
