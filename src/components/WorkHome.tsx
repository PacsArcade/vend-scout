"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MiniMap, type MapPoint } from "./MiniMap";
import type { Offer } from "@/lib/offers";

interface CityOpt { slug: string; name: string }
interface BlockView { id: string; cityName: string; start: string; end: string }
export interface WorkProps {
  me: string; name: string; hasLightning: boolean; hasArea: boolean; online: boolean; done: number; welcomeJobs: number; pin: { lat: number; lon: number } | null;
  cities: CityOpt[]; blocks: BlockView[]; startHours: number[]; lengthHours: number[]; passLine: string; center: [number, number];
}

async function act(body: object) {
  const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json()) as { ok: boolean; error?: string };
}

export function WorkHome(p: WorkProps) {
  const router = useRouter();
  const [online, setOnline] = useState(p.online);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [zones, setZones] = useState<{ lat: number; lon: number; count: number }[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [ln, setLn] = useState("");
  const [city, setCity] = useState(p.cities[0]?.slug ?? "");
  const [bCity, setBCity] = useState(p.cities[0]?.slug ?? "");
  const [startIn, setStartIn] = useState(p.startHours[1]);
  const [len, setLen] = useState(p.lengthHours[1]);

  const step = !p.hasLightning ? 1 : !p.hasArea ? 2 : !online ? 3 : 4;
  const onboarding = step < 4 && p.done === 0;

  const load = useCallback(async () => {
    const q = loc ? `&lat=${loc.lat}&lon=${loc.lon}` : "";
    const r = await fetch(`/api/offers?crew=${p.me}${q}`, { cache: "no-store" });
    const j = (await r.json()) as { offers: Offer[]; zones: typeof zones };
    setOffers(j.offers); setZones(j.zones);
  }, [p.me, loc]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  async function toggle() {
    const r = await act({ action: "goOnline", id: p.me, on: !online });
    if (r.ok) { setOnline(!online); setMsg(!online ? "You are online. Offers will show here." : "You are offline."); router.refresh(); } else setMsg(r.error ?? "That did not work");
  }
  async function accept(o: Offer) {
    const r = await act({ action: "claimJob", job: o.id, kind: o.kind, title: o.title, by: p.me });
    setMsg(r.ok ? "Accepted. It is in My claimed jobs." : (r.error ?? "That did not work"));
    void load(); router.refresh();
  }
  async function pass(o: Offer) { await act({ action: "passJob", by: p.me, job: o.id }); setMsg("Passed."); void load(); }

  const points: MapPoint[] = offers.filter((o) => o.lat !== undefined).map((o) => ({ id: o.id, lat: o.lat!, lon: o.lon!, kind: "stop", label: `${o.title}: ${o.total.toLocaleString("en-US")} sats` }));
  const first = offers[0];

  return (
    <>
      {onboarding && (
        <div className="glass tile">
          <div className="muted small">Set up, step {Math.min(step, 3)} of 3</div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={Math.min(step, 3) - 1}><i style={{ width: `${((Math.min(step, 3) - 1) / 3) * 100}%` }} /></div>
          {step === 1 && (<>
            <h2>Where should we send your sats?</h2>
            <label className="hostfield"><span>Your Lightning address</span><input value={ln} onChange={(e) => setLn(e.target.value)} placeholder="you@wallet.example" /></label>
            <p className="muted small">We will never ask for your seed words or keys.</p>
            <div className="actions"><button className="btn gild full" onClick={async () => { const r = await act({ action: "onboard", id: p.me, lightning: ln }); setMsg(r.ok ? "" : (r.error ?? "")); if (r.ok) router.refresh(); }}>Save and continue</button></div>
          </>)}
          {step === 2 && (<>
            <h2>Where do you work?</h2>
            <label className="hostfield"><span>Pick your city</span><select value={city} onChange={(e) => setCity(e.target.value)}>{p.cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
            <div className="actions">
              <button className="btn gild full" onClick={async () => { const r = await act({ action: "onboard", id: p.me, city }); if (r.ok) router.refresh(); }}>Save and continue</button>
              <button className="btn full" onClick={() => navigator.geolocation?.getCurrentPosition(async (g) => { const r = await act({ action: "onboard", id: p.me, lat: g.coords.latitude, lon: g.coords.longitude }); if (r.ok) router.refresh(); }, () => setMsg("Location was not shared. Pick your city instead."))}>Use my location</button>
            </div>
          </>)}
          {step === 3 && (<>
            <h2>Ready when you are</h2>
            <p className="muted small">Go online to see offers. Go offline any time.</p>
          </>)}
        </div>
      )}
      <button className={"bigtoggle" + (online ? " on" : "")} onClick={toggle} aria-pressed={online} disabled={step < 3 && p.done === 0}>{online ? "You are online. Tap to go offline" : "Go online"}</button>
      <p className="muted small">{p.done < p.welcomeJobs ? `Welcome boost: you get first look at offers near you for your first ${p.welcomeJobs} jobs (${p.done} done).` : "You have done your first jobs. Offers still come nearest first."}</p>
      <div className="actions" style={{ marginTop: 6 }}>
        <button className="btn" onClick={() => navigator.geolocation?.getCurrentPosition((g) => setLoc({ lat: g.coords.latitude, lon: g.coords.longitude }), () => setMsg("Location was not shared. Distances use your city pin."))}>Use my location</button>
      </div>
      <h2 style={{ marginTop: 14 }}>Busy zones</h2>
      <MiniMap points={points} zones={zones} center={p.pin ? [p.pin.lat, p.pin.lon] : p.center} zoom={10} label="Map of busy zones. Shaded areas have more open jobs" />
      <p className="muted small">Shaded areas have more open jobs. Jobs in a busy zone pay a bonus.</p>
      {online && (first ? (
        <div className="glass tile offer">
          <div className="muted small">{first.tag === "block" ? "Your scheduled block" : first.tag === "welcome" ? "Welcome boost" : "Next offer"}</div>
          <h2>{first.title}</h2>
          <p className="muted small">{first.detail}</p>
          <p className="num bigsats">{first.total.toLocaleString("en-US")} sats{first.bonus > 0 && <span className="chip"> + busy bonus {first.bonus.toLocaleString("en-US")}</span>}</p>
          <p className="muted small num">{first.km !== null ? `${first.km.toFixed(1)} km away` : "Distance unknown"}</p>
          <div className="actions"><button className="btn gild full" onClick={() => accept(first)}>Accept</button><button className="btn full" onClick={() => pass(first)}>Pass</button></div>
          <p className="muted small">Pass anytime. No score, no penalty.</p>
        </div>
      ) : <div className="glass tile"><b>No offers right now</b><p className="muted small">We check every 15 seconds. Pass anytime. No score, no penalty.</p></div>)}
      {msg && <p className="okmsg small" role="status">{msg}</p>}
      <div className="glass tile">
        <h2>Schedule a block</h2>
        <p className="muted small">Pick a city and hours ahead. Jobs in that city and block come to you first.</p>
        <label className="hostfield"><span>City</span><select value={bCity} onChange={(e) => setBCity(e.target.value)}>{p.cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
        <label className="hostfield"><span>Starts in</span><select value={startIn} onChange={(e) => setStartIn(Number(e.target.value))}>{p.startHours.map((h) => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}</select></label>
        <label className="hostfield"><span>For how long</span><select value={len} onChange={(e) => setLen(Number(e.target.value))}>{p.lengthHours.map((h) => <option key={h} value={h}>{h} hours</option>)}</select></label>
        <div className="actions"><button className="btn gild full" onClick={async () => { const r = await act({ action: "scheduleBlock", by: p.me, city: bCity, startInH: startIn, lengthH: len }); setMsg(r.ok ? "Block scheduled." : (r.error ?? "")); if (r.ok) router.refresh(); }}>Schedule this block</button></div>
        {p.blocks.map((b) => <div key={b.id} className="step"><span className="n">B</span><div>{b.cityName}<br /><span className="muted small mono">{b.start} to {b.end}</span></div></div>)}
      </div>
      <div className="actions"><Link className="btn full" href={`/run?crew=${p.me}`}>My claimed jobs</Link><Link className="btn full" href={`/work/earnings?crew=${p.me}`}>My earnings</Link></div>
    </>
  );
}
