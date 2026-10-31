"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Bbox, Category, VenueCategory } from "@/lib/types";
import { ALL_CATEGORIES } from "@/lib/types";

export interface Pin { id: string; name: string; area: string; lat: number; lon: number; category: VenueCategory; score: number; late: boolean; why: string }
type Pt = { lat: number; lon: number };

const FILTERS: { key: VenueCategory; label: string }[] = [
  { key: "laundry", label: "Laundromats" },
  { key: "gym", label: "Gyms" },
  { key: "car_wash", label: "Car washes" },
  { key: "car_repair", label: "Auto shops" },
];
const CHIP: Record<VenueCategory, string> = { laundry: "laundromat", gym: "gym", car_wash: "car wash", car_repair: "auto shop" };
const CAT_NAME: Record<Category, string> = { laundry: "laundromats", gym: "gyms", car_wash: "car washes", car_repair: "auto shops", vending: "vending machines", convenience: "convenience shops", fast_food: "fast food" };

export function ScoutClient({ place, bbox, pins, existing, ours, total, hasData }: { place: { slug: string; name: string }; bbox: Bbox; pins: Pin[]; existing: Pt[]; ours: Pt[]; total: number; hasData: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<string, boolean>>({ laundry: true, gym: true, car_wash: true, car_repair: true });
  const [lateOnly, setLateOnly] = useState(false);
  const [sel, setSel] = useState(pins[0]?.id);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [tilesOk, setTilesOk] = useState(true);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false);

  const shown = pins.filter((p) => on[p.category] && (!lateOnly || p.late)).slice(0, 60);
  const list = shown.slice(0, 12);
  const current = shown.find((p) => p.id === sel) ?? shown[0];

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default as typeof Leaflet;
      if (dead || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true });
      map.fitBounds([[bbox.south, bbox.west], [bbox.north, bbox.east]]);
      let loaded = 0, failed = 0;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
      tiles.on("tileload", () => { loaded++; });
      tiles.on("tileerror", () => { failed++; if (failed >= 6 && loaded === 0) setTilesOk(false); });
      tiles.addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => { dead = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [bbox]);

  useEffect(() => {
    const L = LRef.current, layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    for (const m of existing) L.circleMarker([m.lat, m.lon], { radius: 4, color: "#a79fb4", weight: 1.5, fillColor: "#0a0810", fillOpacity: 0.9 }).addTo(layer);
    for (const p of shown) if (p.late && p.score >= 60) L.circleMarker([p.lat, p.lon], { radius: 24, stroke: false, fillColor: "#ff6400", fillOpacity: 0.22, interactive: false }).addTo(layer);
    for (const p of shown) {
      const strong = p.score >= 70, isSel = current?.id === p.id;
      L.circleMarker([p.lat, p.lon], { radius: strong ? 9 : 7, color: isSel ? "#ffffff" : "#d4a843", weight: isSel ? 3 : 2.5, fillColor: "#d4a843", fillOpacity: strong ? 1 : 0 })
        .on("click", () => setSel(p.id)).bindTooltip(`${p.name} · ${p.score}`).addTo(layer);
    }
    for (const m of ours) L.circleMarker([m.lat, m.lon], { radius: 8, color: "#5fd38a", fillColor: "#5fd38a", fillOpacity: 1, weight: 2 }).bindTooltip("Our machine").addTo(layer);
  }, [ready, shown, current, existing, ours]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setStatus("Looking up the place.");
    try {
      const r = await fetch("/api/place?q=" + encodeURIComponent(q));
      const j = (await r.json()) as { ok: boolean; place?: { slug: string }; error?: string };
      if (!j.ok || !j.place) { setStatus(j.error ?? "No place found."); setBusy(false); return; }
      router.push(`/scout?place=${j.place.slug}`);
      setStatus("");
    } catch { setStatus("Place search failed."); }
    setBusy(false);
  }

  async function scan() {
    setBusy(true);
    let i = 0, failed = "";
    for (const c of ALL_CATEGORIES) {
      i++;
      setStatus(`Asking OpenStreetMap for ${CAT_NAME[c]} (${i} of ${ALL_CATEGORIES.length}).`);
      try {
        const r = await fetch(`/api/scout?place=${place.slug}&cat=${c}&refresh=1`);
        const j = (await r.json()) as { ok: boolean; error?: string };
        if (!j.ok) failed = j.error ?? "a request failed";
      } catch { failed = "the connection dropped"; }
    }
    setStatus(failed ? `Some categories failed: ${failed}` : "Scan finished. Places that were already fresh today came from the cache.");
    router.refresh();
    setBusy(false);
  }

  const dots = (() => {
    const w = 900, h = 760;
    const px = (p: Pt) => ({ x: ((p.lon - bbox.west) / (bbox.east - bbox.west)) * w, y: ((bbox.north - p.lat) / (bbox.north - bbox.south)) * h });
    return shown.map((p) => ({ ...px(p), id: p.id, strong: p.score >= 70 }));
  })();

  return (
    <div className="scout">
      <div className="glass map">
        <div ref={mapEl} className="leaf" />
        {!tilesOk && (
          <svg className="fallback" viewBox="0 0 900 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Fallback map, tiles did not load">
            <rect width="900" height="760" fill="#0d0b14" />
            {dots.map((d) => <circle key={d.id} cx={d.x} cy={d.y} r={d.strong ? 9 : 6} fill={d.strong ? "#d4a843" : "none"} stroke="#d4a843" strokeWidth="2" onClick={() => setSel(d.id)} />)}
          </svg>
        )}
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.key} className={"chip" + (on[f.key] ? "" : " off")} onClick={() => setOn({ ...on, [f.key]: !on[f.key] })} aria-pressed={on[f.key]}>{f.label}</button>
          ))}
          <button className={"chip" + (lateOnly ? "" : " off")} onClick={() => setLateOnly(!lateOnly)} aria-pressed={lateOnly}>Open late</button>
        </div>
        <div className="legend glass">
          <span><i className="dot" style={{ background: "var(--gild)" }} />Strong prospect</span>
          <span><i className="dot" style={{ border: "2px solid var(--gild)" }} />Maybe</span>
          <span><i className="dot" style={{ border: "2px solid var(--dim)" }} />Machine already there</span>
          <span><i className="dot" style={{ background: "var(--good)" }} />Our machine</span>
          <span>Glow means open late</span>
        </div>
      </div>
      <div className="glass list">
        <form className="searchrow" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city or place" aria-label="Search a city or place" />
          <button className="btn" type="submit" disabled={busy}>Search</button>
        </form>
        <div className="rowflex"><h2 style={{ margin: 0 }}>Best prospects</h2><span className="muted small">{total} found</span></div>
        <p className="muted small placeline">{place.name}</p>
        <div className="actions">
          {current && <Link href={`/prospects/${current.id}`} className="btn gild">Open prospect</Link>}
          <button className="btn" onClick={scan} disabled={busy}>Scan this place</button>
        </div>
        {status && <p className="muted small" role="status">{status}</p>}
        <div className="rows">
          {list.map((p) => (
            <button key={p.id} className={"pro" + (current?.id === p.id ? " sel" : "")} onClick={() => setSel(p.id)}>
              <div className="score">{p.score}</div>
              <div>
                <b>{p.name}</b>
                <div className="why">{p.area}</div>
                <div><span className="chip">{CHIP[p.category]}</span>{p.late && <span className="chip">open late</span>}</div>
              </div>
            </button>
          ))}
          {list.length === 0 && <p className="muted">{hasData ? "Nothing matches those filters." : `No data for this place yet. Press Scan this place to ask OpenStreetMap.`}</p>}
        </div>
      </div>
    </div>
  );
}
