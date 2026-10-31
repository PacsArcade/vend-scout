import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ProspectActions } from "@/components/ProspectActions";
import { getProspect } from "@/lib/store";
import { openLateValue } from "@/lib/score";
import { STAGES, CATEGORY_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProspect(id);
  if (!data) notFound();
  const { prospect: p, scored, notes } = data;
  const at = STAGES.indexOf(p.stage);
  return (
    <>
      <Nav on="prospects" />
      <div className="two">
        <div className="glass card">
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="score">{scored.score}</div>
            <div>
              <h1>{p.name}</h1>
              <div className="muted">{p.area} · {CATEGORY_LABEL[p.category]} · {openLateValue(p.openingHours).note.toLowerCase()}{p.contact ? ` · owner ${p.contact}` : ""}</div>
            </div>
          </div>
          <div className="pipe">
            {STAGES.map((s, i) => <span key={s} className={i < at ? "done" : i === at ? "now" : ""}>{s}</span>)}
          </div>
          <h2>Why it scores {scored.score}</h2>
          <div className="bars">
            {scored.factors.map((f) => (
              <div key={f.key}>
                <span>{f.label}<br /><span className="muted small">{f.note} · weight {Math.round(f.weight * 100)}%</span></span>
                <span className="bar"><i style={{ width: `${f.value}%` }} /></span>
                <span>{f.value}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Score = venue type 40% + open late 25% + no machine nearby 35%.{p.source === "demo" ? " Demo data." : " Source: OpenStreetMap."}</p>
          <h2 style={{ marginTop: 18 }}>Notes</h2>
          <div className="log">
            {notes.length === 0 && <div className="muted">No notes yet.</div>}
            {notes.map((n, i) => <div key={i}><span className="muted mono">{n.date}</span> · {n.text}</div>)}
          </div>
        </div>
        <div>
          <div className="sheet">
            <h3>A snack machine for {p.name}, at no cost to you</h3>
            <p style={{ marginBottom: 12 }}>We place, stock and clean it. You get a share of every sale, paid monthly.</p>
            <div className="row"><span>Your share</span><b>10% of sales</b></div>
            <div className="row"><span>Space it needs</span><b>3 ft wide, one outlet</b></div>
            <div className="row"><span>Restock</span><b>Twice a week, before 8 AM</b></div>
            <div className="row"><span>Payment</span><b>Card, phone and bitcoin</b></div>
            <div className="row"><span>Your customers pick</span><b>They vote what goes in it</b></div>
            <p style={{ marginTop: 12, fontSize: 13 }}>Whisper · Chicago artist · (phone) · leave it any time with 30 days&apos; notice</p>
          </div>
          <ProspectActions id={p.id} stage={p.stage} />
        </div>
      </div>
    </>
  );
}
