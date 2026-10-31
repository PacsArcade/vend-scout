"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface Pin {
  id: string; name: string; area: string; lat: number; lon: number;
  category: "laundry" | "gym" | "car_wash" | "car_repair"; score: number; why: string; late: boolean; source: "demo" | "osm";
}
type Pt = { lat: number; lon: number };

const FILTERS: { key: Pin["category"]; label: string }[] = [
  { key: "laundry", label: "Laundromats" },
  { key: "gym", label: "Gyms" },
  { key: "car_wash", label: "Car washes" },
  { key: "car_repair", label: "Auto shops" },
];
const CHIP: Record<Pin["category"], string> = { laundry: "laundromat", gym: "gym", car_wash: "car wash", car_repair: "auto shop" };

const W = 900, H = 760;
const LON0 = -87.80, LON1 = -87.50, LAT0 = 41.65, LAT1 = 42.03;
const px = (p: Pt) => ({ x: ((p.lon - LON0) / (LON1 - LON0)) * W, y: ((LAT1 - p.lat) / (LAT1 - LAT0)) * H });
const inView = (p: Pt) => p.lon >= LON0 && p.lon <= LON1 && p.lat >= LAT0 && p.lat <= LAT1;
const LAKE: Pt[] = [
  { lat: 42.03, lon: -87.665 }, { lat: 41.95, lon: -87.635 }, { lat: 41.88, lon: -87.607 }, { lat: 41.80, lon: -87.595 },
  { lat: 41.74, lon: -87.56 }, { lat: 41.65, lon: -87.525 }, { lat: 41.65, lon: -87.5 }, { lat: 42.03, lon: -87.5 },
];

export function ScoutClient({ pins, existing, ours, total }: { pins: Pin[]; existing: Pt[]; ours: Pt[]; total: number }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<string, boolean>>({ laundry: true, gym: true, car_wash: true, car_repair: true });
  const [lateOnly, setLateOnly] = useState(false);
  const [sel, setSel] = useState(pins[0]?.id);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = pins.filter((p) => on[p.category] && (!lateOnly || p.late)).slice(0, 45);
  const labelled = new Set(shown.slice(0, 8).map((p) => p.id));
  const list = shown.slice(0, 12);
  const current = shown.find((p) => p.id === sel) ?? shown[0];

  async function scan() {
    setBusy(true);
    setStatus("Asking OpenStreetMap. This can take a minute.");
    try {
      const res = await fetch("/api/scout?refresh=1");
      const j = (await res.json()) as Record<string, { count: number; live: boolean; error?: string }>;
      const live = Object.values(j).filter((x) => x.live).length;
      const err = Object.values(j).find((x) => x.error);
      setStatus(err ? "Some categories failed: " + err.error : live ? `Updated ${live} categories.` : "Already up to date today (cached).");
      router.refresh();
    } catch {
      setStatus("Scan failed. Try again later.");
    }
    setBusy(false);
  }

  return (
    <div className="scout">
      <div className="glass map">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of Chicago prospects">
          <defs>
            <pattern id="g" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="rgba(255,255,255,.05)" /></pattern>
            <radialGradient id="h1"><stop offset="0" stopColor="rgba(255,100,0,.45)" /><stop offset="1" stopColor="rgba(255,100,0,0)" /></radialGradient>
          </defs>
          <rect width={W} height={H} fill="#0d0b14" /><rect width={W} height={H} fill="url(#g)" />
          <polygon points={LAKE.map((p) => { const q = px(p); return `${q.x},${q.y}`; }).join(" ")} fill="#101a2a" />
          <text x={W - 150} y={H / 2} fill="rgba(160,190,230,.45)" fontSize="16" fontFamily="sans-serif">Lake Michigan</text>
          {existing.filter(inView).map((m, i) => { const q = px(m); return <rect key={i} x={q.x - 4} y={q.y - 4} width="8" height="8" fill="none" stroke="#a79fb4" strokeWidth="1.5" />; })}
          {shown.filter((p) => inView(p) && p.late && p.score >= 75).map((p) => { const q = px(p); return <circle key={"g" + p.id} cx={q.x} cy={q.y} r="60" fill="url(#h1)" pointerEvents="none" />; })}
          {shown.filter(inView).map((p) => {
            const q = px(p);
            const strong = p.score >= 80;
            const isSel = current?.id === p.id;
            return (
              <g key={p.id} onClick={() => setSel(p.id)}>
                <circle cx={q.x} cy={q.y} r={strong ? 10 : 7} fill={strong ? "#d4a843" : "none"} stroke={isSel ? "#fff" : "#d4a843"} strokeWidth={isSel ? 2 : 2.5} />
                {strong && (labelled.has(p.id) || isSel) && <text x={q.x + 14} y={q.y + 5} fill="#ece6f2" fontSize="13" fontFamily="sans-serif">{p.score}</text>}
              </g>
            );
          })}
          {ours.map((m, i) => { const q = px(m); return <path key={i} d={`M${q.x} ${q.y + 6} l9 -16 l9 16z`} fill="#5fd38a" />; })}
        </svg>
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={"chip" + (on[f.key] ? "" : " off")} onClick={() => setOn({ ...on, [f.key]: !on[f.key] })} aria-pressed={on[f.key]}>{f.label}</button>
          ))}
          <button className={"chip" + (lateOnly ? "" : " off")} onClick={() => setLateOnly(!lateOnly)} aria-pressed={lateOnly}>Open late</button>
        </div>
        <div className="legend glass">
          <span><i className="dot" style={{ background: "var(--gild)" }} />Strong prospect</span>
          <span><i className="dot" style={{ border: "2px solid var(--gild)" }} />Maybe</span>
          <span><i className="dot" style={{ border: "2px solid var(--dim)", borderRadius: 2 }} />Machine already there (OSM)</span>
          <span><i className="dot" style={{ background: "var(--good)", borderRadius: 0, clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />Our machine</span>
          <span>Glow = open late</span>
        </div>
      </div>
      <div className="glass list">
        <div className="rowflex"><h2 style={{ margin: 0 }}>Best prospects</h2><span className="muted small">{total} found · sorted by score</span></div>
        <div className="rows">
          {list.map((p) => (
            <button key={p.id} className={"pro" + (current?.id === p.id ? " sel" : "")} onClick={() => setSel(p.id)}>
              <div className="score">{p.score}</div>
              <div>
                <b>{p.name} · {p.area}</b>
                <div className="why">{p.why}</div>
                <div><span className="chip">{CHIP[p.category]}</span>{p.late && <span className="chip">open late</span>}<span className="chip">{p.source === "demo" ? "demo data" : "OpenStreetMap"}</span></div>
              </div>
            </button>
          ))}
          {list.length === 0 && <p className="muted">Nothing matches those filters.</p>}
        </div>
        <div className="actions" style={{ marginTop: "auto" }}>
          {current && <Link href={`/prospects/${current.id}`} className="btn gild">Open {current.name.length > 18 ? "prospect" : current.name}</Link>}
          <button className="btn" onClick={scan} disabled={busy}>Scan a new area</button>
        </div>
        {status && <p className="muted small">{status}</p>}
      </div>
    </div>
  );
}
