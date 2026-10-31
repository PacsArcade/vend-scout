import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PlaceForm, type PlaceChoice } from "@/components/PlaceForm";
import { Empty } from "@/components/Shell";
import { findProspect } from "@/lib/overpass";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PlaceMachine({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  const { prospect } = await searchParams;
  const st = await readState();
  const inventory = st.machines.filter((m) => m.status === "In storage").map((m) => ({ id: m.id, name: m.name, type: m.type, typeOther: m.typeOther }));
  const places: PlaceChoice[] = [];
  for (const [id, stage] of Object.entries(st.tracked)) {
    const h = await findProspect(id);
    if (h) places.push({ id, name: h.prospect.name, stage });
  }
  if (prospect && !places.some((c) => c.id === prospect)) {
    const h = await findProspect(prospect);
    if (h) places.unshift({ id: prospect, name: h.prospect.name, stage: "Not tracked yet" });
  }
  return (
    <>
      <Nav on="machines" />
      <main className="page narrow">
        <h1>Place a machine from inventory</h1>
        <p className="muted">A machine has to be in inventory first, and it is placed at a prospect. The place becomes its host and moves to Placed.</p>
        {inventory.length === 0 ? (
          <Empty title="No machine in storage">
            <p className="muted">Add a machine to inventory first. Only a machine that is In storage can be placed.</p>
            <div className="actions"><Link className="btn gild" href="/machines/inventory">Add to inventory</Link></div>
          </Empty>
        ) : (
          <div className="glass card"><PlaceForm inventory={inventory} places={places} chosenPlace={prospect} /></div>
        )}
      </main>
    </>
  );
}
