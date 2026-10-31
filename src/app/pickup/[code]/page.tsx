import { notFound } from "next/navigation";
import { getMachine, getOrder } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PickupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const o = getOrder(code);
  if (!o) notFound();
  const m = getMachine(o.machine);
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>Vend Scout</span><span>pickup</span></div>
        <h1>Pick it up at a machine</h1>
        <p className="muted small" style={{ marginBottom: 14 }}>Order online. Grab it any time, day or night.</p>
        <div className="glass" style={{ padding: 16, marginBottom: 12 }}><b>{o.item}</b><div className="muted small">{o.paid}</div></div>
        <div className="glass" style={{ padding: 16, textAlign: "center" }}>
          <div className="muted small">Your pickup code</div>
          <div className="code mono">{o.code.split("").join(" ")}</div>
          <div className="muted small">{m?.name} · open 24 hours · held for {o.heldDays} days</div>
        </div>
        <div className="step"><span className="n">1</span><div>Go to the machine and press <b>Pickup</b>.</div></div>
        <div className="step"><span className="n">2</span><div>Type your code, or scan the code on this screen.</div></div>
        <div className="step"><span className="n">3</span><div>Slot <b>{o.slot}</b> drops your print.</div></div>
        <div className="actions"><a className="btn gild full" href="https://www.openstreetmap.org/search?query=Pilsen%20Chicago">Get directions</a></div>
        <p className="muted small" style={{ marginTop: 16, textAlign: "center" }}>Demo order. The drop needs a board in the machine (not built yet).</p>
      </div>
    </div>
  );
}
