import { PhoneBar } from "@/components/PhoneBar";
import { notFound } from "next/navigation";
import { Bft } from "@/components/Bft";
import { RunStop } from "@/components/RunStop";
import { getVotes, localSlots, readState } from "@/lib/store";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ route: string }> }) {
  const { route } = await params;
  const st = await readState();
  const r = st.routes.find((x) => x.id === route);
  if (!r) notFound();
  const runner = st.applicants.find((a) => a.id === r.runner);
  const nextId = r.stops.find((id) => !r.done.some((d) => d.machine === id));
  const m = nextId ? st.machines.find((x) => x.id === nextId) : undefined;
  const low = m ? m.slots.filter((s) => s.kind !== "pickup" && s.level < 0.45) : [];
  const orders = m ? st.orders.filter((o) => o.machine === m.id) : [];
  const shelf = m ? localSlots(st, m.id) : [];
  const vote = m ? (await getVotes(m.id))[0] : undefined;
  return (
    <div className="phonewrap">
      <div className="phone">
        <PhoneBar right="runner" />
        <h1>{r.name}</h1>
        <p className="muted small">{runner ? `Runner: ${runner.name}` : "No runner assigned yet"} · stops logged {r.done.length} of {r.stops.length}</p>
        {!m ? (
          <div className="glass tile center"><h2>Route finished</h2><p className="muted">{r.done.length} stops logged. Thank you.</p></div>
        ) : (
          <>
            <div className="glass tile">
              <div className="muted small">Next stop, {r.done.length + 1} of {r.stops.length}</div>
              <h2>{m.name}</h2>
              <p className="muted small">At {m.hostName}</p>
              <div className="actions"><a className="btn full" href={`https://www.openstreetmap.org/directions?route=%3B${m.lat}%2C${m.lon}`} target="_blank" rel="noopener noreferrer">Directions</a></div>
            </div>
            <h2>Load this stop</h2>
            {low.length === 0 && orders.length === 0 && shelf.length === 0 && !vote && <p className="muted">Nothing is low. Wipe it down and log the stop.</p>}
            {low.map((s) => <div key={s.code} className="step"><span className="n">{s.code}</span><div>{s.name}: fill to full (now {Math.round(s.level * 100)}%) · {sats(s.priceSats)}</div></div>)}
            {orders.map((o) => <div key={o.code} className="step"><span className="n">{o.slot}</span><div>Pickup order {o.code}: {o.item}. Check it is in the held slot.</div></div>)}
            {shelf.map((s) => <div key={s.code} className="step"><span className="n">{s.code}</span><div>Local shelf: {s.name}, {s.qty} left. Check the labels.</div></div>)}
            {vote && <div className="step"><span className="n">+</span><div>Top vote to add: {vote.name} ({vote.total} votes)</div></div>}
            <RunStop route={r.id} machine={m.id} />
          </>
        )}
        {r.done.length > 0 && (
          <>
            <h2 style={{ marginTop: 18 }}>Done</h2>
            {r.done.map((d) => <div key={d.machine} className="step done"><span className="n">ok</span><div>{st.machines.find((x) => x.id === d.machine)?.name}<br /><span className="muted small"><Bft iso={d.at} h={d.h} /></span></div></div>)}
          </>
        )}
      </div>
    </div>
  );
}
