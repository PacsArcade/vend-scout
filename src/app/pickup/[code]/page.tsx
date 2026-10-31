import { notFound } from "next/navigation";
import { readState } from "@/lib/store";
import { sats } from "@/lib/format";
import { SHOP_URL } from "@/lib/handoff";

export const dynamic = "force-dynamic";

export default async function PickupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const st = await readState();
  const o = st.orders.find((x) => x.code === code);
  if (!o) notFound();
  const m = st.machines.find((x) => x.id === o.machine);
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>frens.earth · Machines</span><span>pickup</span></div>
        <h1>Pick it up at a machine</h1>
        <p className="muted small">Order in the shop. Grab it any time, day or night.</p>
        <div className="glass tile"><b>{o.item}</b><div className="muted small">Paid {sats(o.priceSats)} · {o.source}</div></div>
        <div className="glass tile center">
          <div className="muted small">Your pickup code</div>
          <div className="code mono">{o.code.split("").join(" ")}</div>
          <div className="muted small">{m?.name ?? "Machine"} · slot {o.slot}</div>
        </div>
        <div className="step"><span className="n">1</span><div>Go to the machine and press <b>Pickup</b>.</div></div>
        <div className="step"><span className="n">2</span><div>Type your code on the keypad.</div></div>
        <div className="step"><span className="n">3</span><div>Slot <b>{o.slot}</b> drops your order.</div></div>
        <div className="actions"><a className="btn gild full" href={SHOP_URL} target="_blank" rel="noopener noreferrer">Back to the shop</a></div>
        <p className="muted small center">The drop needs a board in the machine. Not built yet.</p>
      </div>
    </div>
  );
}
