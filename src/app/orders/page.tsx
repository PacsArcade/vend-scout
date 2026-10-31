import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ActionForm } from "@/components/Actions";
import { Empty } from "@/components/Shell";
import { readState } from "@/lib/store";
import { SHOP_URL } from "@/lib/handoff";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const st = await readState();
  return (
    <>
      <Nav on="orders" />
      <main className="page">
        <div className="rowflex"><h1>Pickup orders</h1><a className="btn gild" href={SHOP_URL} target="_blank" rel="noopener noreferrer">Open the frens.earth shop</a></div>
        <p className="muted measure">Arcade merch is ordered in the frens.earth shop and picked up at a machine, any hour. In v0 you type the order in by hand. The shop is not connected yet.</p>
        {st.machines.filter((m) => m.status === "Placed").length === 0 ? (
          <Empty title="No machines placed yet">
            <p className="muted">A pickup order needs a machine to wait in.</p>
            <div className="actions"><Link className="btn gild" href="/machines/new">Place a machine</Link></div>
          </Empty>
        ) : (
          <div className="two" style={{ padding: 0 }}>
            <div className="glass card">
              <h2>Add an order from the shop</h2>
              <ActionForm action="order" submit="Create pickup code" redirect="/pickup/{code}" fields={[
                { name: "item", label: "Item", placeholder: "Arcade mini print", wide: true },
                { name: "priceSats", label: "Paid (sats)", type: "number", value: 21000, min: 0 },
                { name: "machine", label: "Machine", type: "select", options: st.machines.filter((m) => m.status === "Placed").map((m) => ({ value: m.id, label: `${m.name} at ${m.hostName}` })) },
                { name: "orderRef", label: "Shop order reference", placeholder: "optional", optional: true, wide: true },
              ]} />
            </div>
            <div className="glass card">
              <h2>Orders waiting</h2>
              {st.orders.length === 0 ? <p className="muted">No orders yet.</p> : (
                <table><tbody>{st.orders.map((o) => <tr key={o.code}><td><Link href={`/pickup/${o.code}`} className="mono">{o.code}</Link></td><td>{o.item}</td><td className="r num">{sats(o.priceSats)}</td></tr>)}</tbody></table>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
