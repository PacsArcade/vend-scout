"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PopView { id: string; by: string; title: string; points: number; sats: number; breakdown: { label: string; points: number }[] }

/** The score pop. Shows once when proof is approved. Motion stops for people who ask for less of it. */
export function PopHost({ pops, me }: { pops: PopView[]; me: string }) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const p = pops.find((x) => x.by === me && !gone.includes(x.id));
  if (!p) return null;
  async function ack() {
    setGone((g) => [...g, p!.id]);
    await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ackPop", id: p!.id }) });
    router.refresh();
  }
  return (
    <div className="popwrap" role="dialog" aria-label="Proof approved">
      <div className="pop">
        <div className="muted small">Proof approved</div>
        <div className="popnum num" aria-label={`${p.points} points`}>+{p.points.toLocaleString("en-US")}</div>
        <div className="popunit">POINTS</div>
        <ul className="popbreak">{p.breakdown.map((b) => <li key={b.label}><span>{b.label}</span><span className="num">+{b.points}</span></li>)}</ul>
        <p className="toast">Paid {p.sats.toLocaleString("en-US")} sats (test)</p>
        <div className="actions"><button className="btn gild full" onClick={ack}>Nice</button></div>
      </div>
    </div>
  );
}
