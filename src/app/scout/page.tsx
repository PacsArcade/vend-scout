import { Nav } from "@/components/Nav";
import { ScoutClient, type Pin } from "@/components/ScoutClient";
import { allProspects } from "@/lib/store";
import { readCache } from "@/lib/overpass";
import { openLateValue } from "@/lib/score";

export const dynamic = "force-dynamic";

export default async function ScoutPage() {
  const all = await allProspects();
  const pins: Pin[] = all.slice(0, 80).map((p) => ({
    id: p.id, name: p.name, area: p.area, lat: p.lat, lon: p.lon, category: p.category, score: p.score, why: p.why,
    late: openLateValue(p.openingHours).value >= 85, source: p.source,
  }));
  const vend = (await readCache("vending"))?.items ?? [];
  const existing = vend.map((v) => ({ lat: v.lat, lon: v.lon }));
  const total = all.length;
  return (
    <>
      <Nav on="scout" />
      <ScoutClient pins={pins} existing={existing} ours={[{ lat: 41.8575, lon: -87.6585 }]} total={total} />
    </>
  );
}
