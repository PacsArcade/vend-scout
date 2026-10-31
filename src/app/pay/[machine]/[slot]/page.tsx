import { notFound } from "next/navigation";
import { FakeQr } from "@/components/FakeQr";
import { getMachine } from "@/lib/store";
import { rail } from "@/lib/payment";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ machine: string; slot: string }> }) {
  const { machine, slot } = await params;
  const m = getMachine(machine);
  const s = m?.slots.find((x) => x.code === slot);
  if (!m || !s) notFound();
  const inv = await rail.createInvoice({ machineId: m.id, slot: s.code, amountSats: s.priceSats });
  return (
    <div className="phonewrap">
      <div className="phone">
        <div className="bar0"><span>Vend Scout</span><span>at the machine</span></div>
        <span className="testtag">TEST MODE · NO REAL PAYMENT</span>
        <h1>Pay with bitcoin</h1>
        <p className="muted small" style={{ marginBottom: 14 }}>{m.name}. Pick a slot, scan the QR on the glass.</p>
        <div className="glass" style={{ padding: 16, textAlign: "center" }}>
          <div className="muted small">Slot {s.code} · {s.name}</div>
          <FakeQr seed={inv.bolt11} />
          <div className="code mono" style={{ fontSize: 28, letterSpacing: ".06em" }}>{inv.amountSats.toLocaleString("en-US")} sats</div>
          <div className="muted small">Lightning · paid in seconds (once a rail is plugged in)</div>
          <div className="invoice mono">{inv.bolt11}</div>
        </div>
        <div className="step"><span className="n">1</span><div>Scan with any Lightning wallet.</div></div>
        <div className="step"><span className="n">2</span><div>Pay. The machine hears it right away.</div></div>
        <div className="step"><span className="n">3</span><div>Slot <b>{s.code}</b> turns and drops your item.</div></div>
        <p className="muted small" style={{ marginTop: 14, textAlign: "center" }}>Placeholder invoice from the stub rail ({`${rail.name}`}). Not a real invoice.</p>
      </div>
    </div>
  );
}
