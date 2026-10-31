import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ProspectActions } from "@/components/ProspectActions";
import { findProspect } from "@/lib/overpass";
import { readState } from "@/lib/store";
import { openLateValue } from "@/lib/score";
import { STAGES, CATEGORY_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hit = await findProspect(id);
  if (!hit) notFound();
  const { prospect: p, scored } = hit;
  const st = await readState();
  const stage = st.tracked[id] ?? null;
  const notes = st.notes[id] ?? [];
  const at = stage ? STAGES.indexOf(stage) : -1;
  return (
    <>
      <Nav on="prospects" />
      <div className="two">
        <div className="glass card">
          <div className="headrow">
            <div className="score">{scored.score}</div>
            <div>
              <h1>{p.name}</h1>
              <div className="muted">{CATEGORY_LABEL[p.category]} · {p.area} · {openLateValue(p.openingHours).note.toLowerCase()}</div>
            </div>
          </div>
          <div className="pipe">
            {STAGES.map((s, i) => <span key={s} className={i < at ? "done" : i === at ? "now" : ""}>{s}</span>)}
          </div>
          {stage === null && <p className="muted small">Not tracked yet. Press Track this place to start the stage track.</p>}
          <h2>Why it scores {scored.score}</h2>
          <div className="bars">
            {scored.factors.map((f) => (
              <div key={f.key}>
                <span>{f.label}<br /><span className="muted small">{f.note}</span></span>
                <span className="bar"><i style={{ width: `${f.value}%` }} /></span>
                <span className="num">{f.value}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Each bar is a 0 to 100 reading, weighted: {scored.factors.map((f) => `${f.label} ${Math.round(f.weight * 100)}%`).join(", ")}. Source: OpenStreetMap, {p.lat.toFixed(4)}, {p.lon.toFixed(4)}.</p>
          <h2 style={{ marginTop: 18 }}>Notes</h2>
          <div className="log">
            {notes.length === 0 && <div className="muted">No notes yet.</div>}
            {notes.map((n, i) => <div key={i}><span className="muted mono">{n.date}</span> · {n.text}</div>)}
          </div>
        </div>
        <div>
          <div className="sheet">
            <h3>A snack machine for {p.name}, at no cost to you</h3>
            <p>We place, stock and clean it. You get a share of every sale, paid monthly in bitcoin.</p>
            <div className="row"><span>Your share</span><b>10% of sales</b></div>
            <div className="row"><span>Space it needs</span><b>3 ft wide, one outlet</b></div>
            <div className="row"><span>Restock</span><b>Twice a week, before 8 AM</b></div>
            <div className="row"><span>Payment</span><b>Bitcoin, priced in sats</b></div>
            <div className="row"><span>Your customers pick</span><b>They vote what goes in it</b></div>
            <div className="row"><span>Local makers</span><b>Neighbours can sell on your shelf</b></div>
            <p className="small">Pac&apos;s Arcade, at frens.earth · (phone) · leave any time with 30 days&apos; notice</p>
          </div>
          <ProspectActions id={id} stage={stage} />
        </div>
      </div>
    </>
  );
}
