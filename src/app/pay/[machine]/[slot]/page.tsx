import { notFound } from "next/navigation";
import Link from "next/link";
import { FakeQr } from "@/components/FakeQr";
import { PayButton } from "@/components/PayButton";
import { localSlots, readState } from "@/lib/store";
import { rail } from "@/lib/payment";
import { sats } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ machine: string; slot: string }> }) {
  const { machine, slot } = await params;
  const st = await readState();
  const m = st.machines.find((x) => x.id === machine);
  const s = m ? [...m.slots, ...localSlots(st, machine)].find((x) => x.code === slot) : undefined;
  if (!m || !s) notFound();
  const inv = await rail.createInvoice({ machineId: m.id, slot: s.code, amountSats: s.priceSats });
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>frens.earth · Machines</span><span>at the machine</span></div>
        <span className="testtag">TEST MODE · NO REAL PAYMENT</span>
        <h1>Pay with bitcoin</h1>
        <p className="muted small">{m.name}. Scan the QR on the glass.</p>
        <div className="glass tile center">
          <div className="muted small">Slot {s.code} · {s.name}</div>
          <FakeQr seed={inv.bolt11} />
          <div className="code mono sm">{s.kind === "pickup" ? "pickup only" : sats(inv.amountSats)}</div>
          <div className="muted small">Lightning, paid in seconds once a rail is plugged in</div>
          <div className="invoice mono">{inv.bolt11}</div>
        </div>
        <div className="step"><span className="n">1</span><div>Scan with any Lightning wallet.</div></div>
        <div className="step"><span className="n">2</span><div>Pay. The machine hears it right away.</div></div>
        <div className="step"><span className="n">3</span><div>Slot <b>{s.code}</b> turns and drops your item.</div></div>
        {s.kind !== "pickup" && <div className="actions"><PayButton machine={m.id} slot={s.code} /></div>}
        <div className="actions"><Link className="btn full" href={`/machines/${m.id}`}>Back to the machine</Link></div>
        <p className="muted small center">Placeholder invoice from the {rail.name} rail. Not a real invoice.</p>
      </div>
    </div>
  );
}
