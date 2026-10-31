import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PlaceForm } from "@/components/PlaceForm";
import { Empty } from "@/components/Shell";
import { findProspect } from "@/lib/overpass";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminPlace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hit = await findProspect(id);
  if (!hit) notFound();
  const st = await readState();
  const inventory = st.machines.filter((m) => m.status === "In storage").map((m) => ({ id: m.id, name: m.name, type: m.type, typeOther: m.typeOther }));
  const asked = st.hostPicks[id];
  return (
    <>
      <Nav on="admin" />
      <main className="page narrow">
        <h1>Pick a machine for {hit.prospect.name}</h1>
        <p className="muted">Choose from machines In storage, then confirm. The place moves to Placed.</p>
        {asked && <p className="small">The host asked for: {[...asked.types, asked.other].filter(Boolean).join(", ")}.</p>}
        {inventory.length === 0 ? (
          <Empty title="No machine in storage"><p className="muted">Add one to inventory first.</p><div className="actions"><Link className="btn gild" href="/machines/inventory">Add to inventory</Link></div></Empty>
        ) : (
          <div className="glass card"><PlaceForm inventory={inventory} places={[]} lockedPlace={{ id, name: hit.prospect.name }} /></div>
        )}
        <Link className="btn" href="/admin">Back to admin</Link>
      </main>
    </>
  );
}
