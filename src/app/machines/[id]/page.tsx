import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getMachine, getVotes } from "@/lib/store";

export const dynamic = "force-dynamic";

const color = (l: number) => (l < 0.25 ? "var(--bad)" : l < 0.45 ? "var(--warn)" : "var(--good)");

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMachine(id);
  if (!m) notFound();
  const votes = await getVotes(id);
  const restock = m.slots.filter((s) => !s.pickup && s.level < 0.45);
  return (
    <>
      <Nav on="machines" />
      <div className="mach">
        <div className="glass card">
          <h2>{m.name}</h2>
          <div className="muted small">Placed {m.placed} · next restock {m.nextRestock}</div>
          <div className="slots">
            {m.slots.map((s) => (
              <Link key={s.code} href={`/pay/${m.id}/${s.code}`} className={"slot" + (s.dw ? " dw" : "")}>
                <b>{s.code}</b>{s.pickup ? "Held for an order" : s.name}
                <div className="lvl"><i style={{ width: `${s.level * 100}%`, background: s.pickup ? "var(--gild)" : color(s.level) }} /></div>
              </Link>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 14 }}>
            <span className="chip" style={{ borderColor: "rgba(212,168,67,.55)", color: "var(--gild)" }}>gold</span> Whisper&apos;s art and DW stickers · <span className="chip">P</span> held for a pickup order. Tap a slot for its bitcoin page.
          </div>
        </div>
        <div className="col">
          <div className="kpis">
            <div className="glass kpi"><span className="muted">Today</span><div className="v">${m.today}</div></div>
            <div className="glass kpi"><span className="muted">This week</span><div className="v">${m.week}</div></div>
            <div className="glass kpi"><span className="muted">Paid in bitcoin</span><div className="v">{m.btcShare}%</div></div>
            <div className="glass kpi"><span className="muted">Host&apos;s share owed</span><div className="v">${m.hostOwed}</div></div>
          </div>
          <div className="glass card">
            <h2>How people paid</h2>
            <div className="pays"><span className="chip">Card reader</span><span className="chip">Phone tap</span><span className="chip" style={{ color: "var(--gild)", borderColor: "rgba(212,168,67,.55)" }}>Lightning QR on the glass</span><span className="chip">Pickup code</span></div>
            <table style={{ marginTop: 12 }}>
              <thead><tr><th>Item</th><th>Sold this week</th><th>Left</th><th>Order more</th></tr></thead>
              <tbody>
                {m.sales.map((r) => (
                  <tr key={r.item}><td>{r.item}</td><td>{r.sold}</td><td>{r.left}</td>
                    <td style={{ color: r.left <= 3 ? "var(--bad)" : r.left <= 5 ? "var(--warn)" : undefined }}>{r.left <= 3 ? "Yes, low" : r.left <= 5 ? "Soon" : "No"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="glass card">
            <h2>Thursday&apos;s restock list</h2>
            <p className="muted small">Every slot under 45% full, plus the top vote.</p>
            <table style={{ marginTop: 8 }}>
              <tbody>
                {restock.map((s) => <tr key={s.code}><td>{s.code}</td><td>{s.name}</td><td style={{ color: color(s.level) }}>{Math.round(s.level * 100)}% full</td></tr>)}
                {votes[0] && <tr><td>Vote</td><td>{votes[0].name}</td><td className="muted">{votes[0].total} votes, new item</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link href={`/vote/${m.id}`} className="btn gild">See the votes ({votes.reduce((a, v) => a + v.total, 0)})</Link>
            <Link href="/pickup/4219" className="btn">Open a pickup order</Link>
          </div>
        </div>
      </div>
    </>
  );
}
