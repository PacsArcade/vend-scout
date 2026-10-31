import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Empty } from "@/components/Shell";
import { readState, salesSummary } from "@/lib/store";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const st = await readState();
  return (
    <>
      <Nav on="machines" />
      <main className="page">
        <div className="rowflex"><h1>Machines</h1><span className="btnrow"><Link className="btn" href="/machines/inventory">Machine inventory</Link><Link className="btn gild" href="/machines/new">Place a machine</Link></span></div>
        {st.machines.length === 0 ? (
          <Empty title="No machines yet">
            <p className="muted">Add a machine to inventory first. Then place it at a prospect you have tracked.</p>
          </Empty>
        ) : (
          <div className="glass card">
            <table>
              <thead><tr><th>Machine</th><th>Status</th><th>Host place</th><th className="r">Slots</th><th className="r">Sold this week</th></tr></thead>
              <tbody>{st.machines.map((m) => <tr key={m.id}><td><Link href={`/machines/${m.id}`}>{m.name}</Link></td><td>{m.status}</td><td>{m.prospectId ? <Link href={`/prospects/${m.prospectId}`}>{m.hostName}</Link> : <span className="muted">Not placed</span>}</td><td className="r num">{m.slots.length}</td><td className="r num">{sats(salesSummary(st, m.id).week)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
