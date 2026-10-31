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
        <div className="rowflex"><h1>Machines</h1><Link className="btn gild" href="/machines/new">Place a machine</Link></div>
        {st.machines.length === 0 ? (
          <Empty title="No machines placed yet">
            <p className="muted">A machine is placed at a prospect. Find a place on the map, track it, then place a machine there.</p>
          </Empty>
        ) : (
          <div className="glass card">
            <table>
              <thead><tr><th>Machine</th><th>Host place</th><th className="r">Slots</th><th className="r">Sold this week</th></tr></thead>
              <tbody>{st.machines.map((m) => <tr key={m.id}><td><Link href={`/machines/${m.id}`}>{m.name}</Link></td><td><Link href={`/prospects/${m.prospectId}`}>{m.hostName}</Link></td><td className="r num">{m.slots.length}</td><td className="r num">{sats(salesSummary(st, m.id).week)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
