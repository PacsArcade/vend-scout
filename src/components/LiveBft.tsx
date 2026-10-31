"use client";
import { useEffect, useState } from "react";
import { face, faceText, nextArrival, type Arrival } from "@/lib/liveBft";

/** The header clock. Polls the tip door every 30 s, ticks every second. */
export function LiveBft() {
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [now, setNow] = useState(0);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let dead = false;
    async function poll() {
      try {
        const demo = new URLSearchParams(window.location.search).get("demoAge");
        const r = await fetch("/api/chain/tip" + (demo ? `?demoAge=${encodeURIComponent(demo)}` : ""), { cache: "no-store" });
        const j = (await r.json()) as { ok: boolean; height?: number; tipTimestamp?: number | null };
        if (dead) return;
        if (j.ok && j.height) {
          const t = Date.now();
          setArrival((prev) => nextArrival(prev, j.height!, j.tipTimestamp ?? null, t)); // first seen = this moment for a new height
          setNow(t); setDown(false);
        } else setDown(true);
      } catch { if (!dead) setDown(true); }
    }
    void poll();
    const p = setInterval(poll, 30_000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { dead = true; clearInterval(p); clearInterval(t); };
  }, []);

  if (!arrival || !now) return <span className="stamp mono" data-clock>{down ? "Block time unavailable" : "Reading the chain"}</span>;
  const f = face(arrival, now);
  const parts = [f.date, `${f.est ? "~" : ""}${f.time} a₿`, `block ${f.height.toLocaleString("en-US")}`];
  return (
    <span className="stamp mono clockline" data-clock aria-label={faceText(f)}>
      {parts.map((t, i) => <span key={i}><span className="unit">{t.replace(/ /g, "\u00a0")}</span>{i < parts.length - 1 ? " · " : ""}</span>)}
      {down ? <span className="unit">last reading</span> : null}
    </span>
  );
}
