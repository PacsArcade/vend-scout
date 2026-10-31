"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Bundle, Job } from "@/lib/jobs";

type Crew = { id: string; name: string; lat?: number; lon?: number };
const KIND: Record<string, string> = { restock: "Restock", scout: "Scout", shelf: "Shelf pickup", tech: "Tech job" };

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function JobsBoard({ jobs, bundles, crew, rate }: { jobs: Job[]; bundles: Bundle[]; crew: Crew[]; rate: string }) {
  const router = useRouter();
  const [me, setMe] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [kind, setKind] = useState("all");
  const [msg, setMsg] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMe(localStorage.getItem("vs-me") ?? ""); }, []);
  const who = crew.find((c) => c.id === me);
  const from = loc ?? (who?.lat !== undefined ? { lat: who.lat, lon: who.lon! } : null);
  const dist = (p: { lat?: number; lon?: number }) => (from && p.lat !== undefined ? km(from, { lat: p.lat, lon: p.lon! }) : null);
  const shown = jobs.filter((j) => kind === "all" || j.kind === kind).map((j) => ({ ...j, d: dist(j) })).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));

  async function act(body: object, ok: string) {
    if (!me) { setMsg("Pick who you are first."); return; }
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setMsg(j.ok ? ok : (j.error ?? "That did not work"));
    if (j.ok) router.refresh();
  }

  return (
    <>
      <div className="glass card">
        <div className="form">
          <label><span>I am</span>
            <select value={me} onChange={(e) => { setMe(e.target.value); localStorage.setItem("vs-me", e.target.value); }}>
              <option value="">Pick your name</option>
              {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label><span>Job type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All jobs</option>
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setLoc({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setMsg("Location was not shared. Distances use your area pin if you set one."))}>Use my location</button>
          <Link className="btn" href={me ? `/run?crew=${me}` : "/run"}>My claimed jobs</Link>
        </div>
        <p className="muted small">{rate}. Pay is the job&apos;s sats at the day&apos;s rate. Distance is straight-line {loc ? "from your location" : from ? "from your area pin" : "once we know where you are"}.</p>
        {msg && <p className="small okmsg" role="status">{msg}</p>}
      </div>
      {bundles.length > 0 && (
        <div className="cards">
          {bundles.map((b) => {
            const d = dist(b);
            return (
              <div key={b.route} className="glass card item">
                <span className="chip">Route bundle</span>
                <h2>{b.name}</h2>
                <p className="muted small">{b.stops} stops, one runner. {d !== null ? `${d.toFixed(1)} km to the first stop.` : ""}</p>
                <div className="foot2"><span className="num">{b.sats.toLocaleString("en-US")} sats</span></div>
                <button className="btn gild" onClick={() => act({ action: "routeRunner", id: b.route, runner: me }, "Route claimed. Open My claimed jobs.")}>Claim the route</button>
              </div>
            );
          })}
        </div>
      )}
      {shown.length === 0 ? (
        <div className="glass card"><h2>No open jobs right now</h2><p className="muted">Jobs show up when a machine runs low, a prospect is waiting for a pitch, a local item is ready for pickup, or a machine needs repair.</p></div>
      ) : (
        <div className="cards">
          {shown.map((j) => (
            <div key={j.id} className="glass card item">
              <span className="chip">{KIND[j.kind]}</span>
              <h2>{j.title}</h2>
              <p className="muted small">{j.detail}</p>
              <div className="foot2"><span className="num">{j.sats.toLocaleString("en-US")} sats</span><span className="muted small num">{j.d !== null ? `${j.d.toFixed(1)} km away` : "distance unknown"}</span></div>
              <button className="btn gild" onClick={() => act({ action: "claimJob", job: j.id, kind: j.kind, title: j.title, by: me }, "Claimed. It is in My claimed jobs.")}>Claim</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
