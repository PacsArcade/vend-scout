/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ActionButton, ActionForm } from "@/components/Actions";
import { Bft } from "@/components/Bft";
import { ProfileEditor } from "@/components/ProfileEditor";
import { feed } from "@/lib/stockFeed";
import { TELEMETRY_LABEL } from "@/lib/types";
import { getVotes, localSlots, readState, salesSummary } from "@/lib/store";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

const color = (l: number) => (l < 0.25 ? "var(--bad)" : l < 0.45 ? "var(--warn)" : "var(--good)");

export default async function MachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const st = await readState();
  const m = st.machines.find((x) => x.id === id);
  if (!m) notFound();
  const votes = await getVotes(id);
  const sum = salesSummary(st, id);
  const readings = await feed.readings(id);
  const locals = localSlots(st, id);
  const pending = st.listings.filter((l) => l.machine === id && l.status === "pending");
  const low = m.slots.filter((s) => s.kind !== "pickup" && s.level < 0.45);
  const stocked = m.slots.filter((s) => s.kind !== "pickup" && s.level > 0).length + locals.length;
  const byItem = new Map<string, number>();
  for (const s of st.sales.filter((x) => x.machine === id)) byItem.set(s.item, (byItem.get(s.item) ?? 0) + 1);
  const owed = Math.round((sum.total * m.hostSharePct) / 100);
  const none = m.slots.length === 0 && locals.length === 0;
  return (
    <>
      <Nav on="machines" />
      <div className="mach">
        <div className="glass card">
          <h2>{m.name}</h2>
          <div className="muted small">Host <Link href={`/prospects/${m.prospectId}`}>{m.hostName}</Link> · placed <Bft iso={m.placedAt} h={m.h} /> · host share {m.hostSharePct}%</div>
          {none ? <p className="muted" style={{ marginTop: 14 }}>No slots yet. Add the first slot below.</p> : (
            <div className="slots">
              {m.slots.map((s) => (
                <Link key={s.code} href={`/pay/${m.id}/${s.code}`} className={`slot ${s.kind}`}>
                  <b>{s.code}{s.kind !== "pickup" && <i className="rep" title={s.report === "sensor" ? "Reported by a sensor" : "Counted by hand"}>{s.report === "sensor" ? "S" : "H"}</i>}</b><span className="nm">{s.kind === "pickup" ? "Held for an order" : s.name}</span>
                  <span className="foot"><span className="num">{s.kind === "pickup" ? "held" : `${Math.round(s.level * 100)}%`}</span><span className="lvl"><i style={{ width: `${s.level * 100}%`, background: s.kind === "pickup" ? "var(--gild)" : color(s.level) }} /></span></span>
                </Link>
              ))}
              {locals.map((s) => (
                <Link key={s.code} href={`/pay/${m.id}/${s.code}`} className="slot local">
                  <b>{s.code}</b><span className="nm">{s.name}</span>
                  <span className="foot"><span className="num">{s.qty} left</span><span className="lvl"><i style={{ width: `${s.level * 100}%`, background: "var(--shelf)" }} /></span></span>
                </Link>
              ))}
            </div>
          )}
          <p className="muted small" style={{ marginTop: 14 }}>S sensor-reported, H counted by hand · <span className="chip" style={{ borderColor: "rgba(212,168,67,.55)", color: "var(--gild)" }}>gold</span> arcade merch · <span className="chip" style={{ borderColor: "var(--shelf)", color: "var(--shelf)" }}>teal</span> local shelf · <span className="chip">held</span> pickup order. Tap a slot for its bitcoin page.
          </p>
        </div>
        <div className="col">
          <div className="kpis">
            <div className="glass kpi"><span className="muted">Today</span><div className="v">{sats(sum.today)}</div></div>
            <div className="glass kpi"><span className="muted">This week</span><div className="v">{sats(sum.week)}</div></div>
            <div className="glass kpi"><span className="muted">Slots stocked</span><div className="v">{stocked}</div></div>
            <div className="glass kpi"><span className="muted">Host share owed</span><div className="v">{sats(owed)}</div></div>
          </div>
          <div className="glass card">
            <h2>What sold</h2>
            {byItem.size === 0 ? <p className="muted">No sales yet. Test payments from a slot page show up here.</p> : (
              <table>
                <thead><tr><th>Item</th><th className="r">Sold</th></tr></thead>
                <tbody>{[...byItem].map(([k, v]) => <tr key={k}><td>{k}</td><td className="r num">{v}</td></tr>)}</tbody>
              </table>
            )}
          </div>
          {pending.length > 0 && (
            <div className="glass card">
              <h2>Waiting for the host</h2>
              <table><tbody>{pending.map((l) => (
                <tr key={l.id}><td><Link href={`/shelf/${l.id}`}>{l.item}</Link><br /><span className="muted small">{l.madeBy}</span></td>
                  <td className="r"><span className="btnrow"><ActionButton label="Approve" gild payload={{ action: "decide", id: l.id, status: "approved" }} /><ActionButton label="Decline" payload={{ action: "decide", id: l.id, status: "declined" }} /></span></td></tr>
              ))}</tbody></table>
            </div>
          )}
          <div className="glass card">
            <h2>Restock list</h2>
            {low.length === 0 ? <p className="muted">Nothing is running low.</p> : (
              <table>
                <tbody>
                  {low.map((s) => <tr key={s.code}><td>{s.code}</td><td>{s.name}</td><td className="r num" style={{ color: color(s.level) }}>{Math.round(s.level * 100)}% full</td></tr>)}
                  {votes[0] && <tr><td>Vote</td><td>{votes[0].name}</td><td className="r num muted">{votes[0].total} votes</td></tr>}
                </tbody>
              </table>
            )}
            {low.length > 0 && <div className="actions"><ActionButton label="Mark these restocked" gild payload={{ action: "restock", machine: id }} /></div>}
          </div>
          {(m.profile.telemetry === "camera" || m.profile.telemetry === "sensors") && (
            <div className="glass card">
              <h2>Stock from sensors</h2>
              <p className="muted small">Telemetry: {TELEMETRY_LABEL[m.profile.telemetry]}. Feed: {feed.name}. Slots marked S take their count from the feed. Slots marked H are counted by hand at restock.</p>
              {readings.length === 0 ? <p className="muted">No readings yet. Nothing is connected, so every slot still counts by hand.</p> : (
                <table><tbody>{readings.map((r) => <tr key={r.slot}><td>{r.slot}</td><td className="r num">{r.count}</td><td className="muted small">{r.source}</td></tr>)}</tbody></table>
              )}
            </div>
          )}
          <div className="glass card">
            <h2>Machine profile</h2>
            <table>
              <tbody>
                <tr><td className="muted small">Make and model</td><td>{[m.profile.make, m.profile.model].filter(Boolean).join(" ") || "Not recorded"}</td></tr>
                <tr><td className="muted small">Serial</td><td className="brk">{m.profile.serial || "Not recorded"}</td></tr>
                <tr><td className="muted small">Label code</td><td className="brk">{m.profile.rawCode || "Not scanned"}</td></tr>
                <tr><td className="muted small">Payment</td><td>{[m.profile.cardReader && `Card reader ${m.profile.cardReader}`, m.profile.cash && "Cash", m.profile.lightning && "Lightning board"].filter(Boolean).join(", ") || "Not recorded"}</td></tr>
                <tr><td className="muted small">Telemetry</td><td>{TELEMETRY_LABEL[m.profile.telemetry]}</td></tr>
                {m.profile.notes && <tr><td className="muted small">Notes</td><td>{m.profile.notes}</td></tr>}
              </tbody>
            </table>
            {m.profile.labelPhoto && <img className="labelphoto" src={`/api/label/${m.id}`} alt="Photo of the machine label" />}
            <ProfileEditor machineId={m.id} initial={m.profile} />
          </div>
          <div className="glass card">
            <h2>Add a slot</h2>
            <ActionForm action="addSlot" extra={{ machine: id }} submit="Add slot" doneText="Slot added." fields={[
              { name: "name", label: "Item", placeholder: "Hot chips" },
              { name: "kind", label: "Kind", type: "select", value: "snack", options: [{ value: "snack", label: "Snack or drink" }, { value: "merch", label: "Arcade merch" }] },
              { name: "priceSats", label: "Price (sats)", type: "number", value: 3000, min: 1 },
              { name: "level", label: "Stocked (%)", type: "number", value: 100, min: 0, max: 100 },
              { name: "report", label: "Counted by", type: "select", value: m.profile.telemetry === "sensors" || m.profile.telemetry === "camera" ? "sensor" : "hand", options: [{ value: "hand", label: "Hand" }, { value: "sensor", label: "Sensor" }] },
            ]} />
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link href={`/vote/${m.id}`} className="btn gild">See the votes</Link>
            <Link href={`/shelf/new?machine=${m.id}`} className="btn">List a local item</Link>
            <Link href="/orders" className="btn">Add a pickup order</Link>
          </div>
        </div>
      </div>
    </>
  );
}
