import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ActionForm } from "@/components/Actions";
import { Empty } from "@/components/Shell";
import { LOCAL_FOOD_NOTE, readState } from "@/lib/store";
import { SHELF_KINDS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewListing({ searchParams }: { searchParams: Promise<{ machine?: string }> }) {
  const { machine } = await searchParams;
  const st = await readState();
  return (
    <>
      <Nav on="shelf" />
      <main className="page narrow">
        <h1>List an item</h1>
        {st.machines.length === 0 ? (
          <Empty title="No machines placed yet">
            <p className="muted">An item needs a machine to sit in. Add a machine first.</p>
            <div className="actions"><Link className="btn gild" href="/machines/new">Add a machine</Link></div>
          </Empty>
        ) : (
          <div className="glass card">
            <ActionForm action="listing" submit="Send for host approval" redirect="/shelf/{id}" fields={[
              { name: "item", label: "Item", placeholder: "Wildflower honey, 8 oz jar", wide: true },
              { name: "kind", label: "Kind", type: "select", value: "honey", options: SHELF_KINDS.map((k) => ({ value: k, label: k })) },
              { name: "machine", label: "Machine", type: "select", value: machine, options: st.machines.map((m) => ({ value: m.id, label: m.name })) },
              { name: "priceSats", label: "Price (sats)", type: "number", value: 10000, min: 1 },
              { name: "qty", label: "How many", type: "number", value: 6, min: 1, max: 500 },
              { name: "pickupWindow", label: "Pickup window", placeholder: "Sat 9 AM to noon", wide: true },
              { name: "madeBy", label: "Made by", placeholder: "Short line: who you are and where it is made", wide: true },
            ]} />
            <p className="muted small" style={{ marginTop: 14 }}>{LOCAL_FOOD_NOTE}</p>
          </div>
        )}
      </main>
    </>
  );
}
