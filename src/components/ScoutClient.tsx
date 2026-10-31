"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Bbox, Category, VenueCategory } from "@/lib/types";
import { ALL_CATEGORIES } from "@/lib/types";

export interface Pin { id: string; name: string; area: string; lat: number; lon: number; category: VenueCategory; score: number; late: boolean; site: boolean }
type Pt = { lat: number; lon: number };
type View = { s: number; w: number; n: number; e: number };

const FILTERS: { key: VenueCategory; label: string }[] = [
  { key: "laundry", label: "Laundromats" },
  { key: "gym", label: "Gyms" },
  { key: "car_wash", label: "Car washes" },
  { key: "car_repair", label: "Auto shops" },
];
const CHIP: Record<VenueCategory, string> = { laundry: "laundromat", gym: "gym", car_wash: "car wash", car_repair: "auto shop" };
const CAT_NAME: Record<Category, string> = { laundry: "Laundromats", gym: "Gyms", car_wash: "Car washes", car_repair: "Auto shops", vending: "Vending machines", convenience: "Convenience shops", fast_food: "Fast food" };

export function ScoutClient({ place, bbox, pins, existing, ours, total, hasData, top20, initialView, initialTab }: { place: { slug: string; name: string }; bbox: Bbox; pins: Pin[]; existing: Pt[]; ours: Pt[]; total: number; hasData: boolean; top20: string[]; initialView?: { lat: number; lon: number; zoom: number }; initialTab: "map" | "list" }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<string, boolean>>({ laundry: true, gym: true, car_wash: true, car_repair: true });
  const [lateOnly, setLateOnly] = useState(false);
  const [sel, setSel] = useState(pins[0]?.id);
  const [hover, setHover] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [view, setView] = useState<View | null>(null);
  const [tab, setTab] = useState<"map" | "list">(initialTab);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [tilesOk, setTilesOk] = useState(true);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const clusterRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const glowRef = useRef<Leaflet.LayerGroup | null>(null);
  const ringRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  const shown = pins.filter((p) => on[p.category] && (!lateOnly || p.late));
  const inView = follow && view ? shown.filter((p) => p.lat >= view.s && p.lat <= view.n && p.lon >= view.w && p.lon <= view.e) : shown;
  const list = inView.slice(0, 15);
  const current = shown.find((p) => p.id === sel) ?? inView[0] ?? shown[0];
  const byId = new Map(pins.map((p) => [p.id, p]));

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default as typeof Leaflet;
      await import("leaflet.markercluster");
      if (dead || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true });
      if (initialView) map.setView([initialView.lat, initialView.lon], initialView.zoom);
      else map.fitBounds([[bbox.south, bbox.west], [bbox.north, bbox.east]]);
      let loaded = 0, failed = 0;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
      tiles.on("tileload", () => { loaded++; });
      tiles.on("tileerror", () => { failed++; if (failed >= 6 && loaded === 0) setTilesOk(false); });
      tiles.addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      glowRef.current = L.layerGroup().addTo(map);
      ringRef.current = L.layerGroup().addTo(map);
      const sync = () => { if (!mapEl.current || mapEl.current.clientWidth < 50) return; const b = map.getBounds(); setView({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }); };
      map.on("moveend", sync);
      sync();
      mapRef.current = map;
      setReady(true);
    })();
    return () => { dead = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [bbox]); // eslint-disable-line react-hooks/exhaustive-deps

  // machines already mapped: grey clusters that open up at street level
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map) return;
    const g = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, disableClusteringAtZoom: 15, showCoverageOnHover: false,
      iconCreateFunction: (c) => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: "cl cl-machine", iconSize: [30, 30] }) });
    for (const m of existing) g.addLayer(L.circleMarker([m.lat, m.lon], { radius: 4, color: "#a79fb4", weight: 1.5, fillColor: "#0a0810", fillOpacity: 0.9 }));
    for (const m of ours) g.addLayer(L.circleMarker([m.lat, m.lon], { radius: 8, color: "#5fd38a", fillColor: "#5fd38a", fillOpacity: 1, weight: 2 }).bindTooltip("Our machine"));
    map.addLayer(g);
    return () => { map.removeLayer(g); };
  }, [ready, existing, ours]);

  // prospects: gold clusters with counts that split as you zoom
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map) return;
    const g = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 55, disableClusteringAtZoom: 16, showCoverageOnHover: false,
      iconCreateFunction: (c) => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: "cl cl-gild", iconSize: [38, 38] }) });
    for (const p of shown) {
      const strong = p.score >= 70;
      g.addLayer(L.circleMarker([p.lat, p.lon], { radius: strong ? 9 : 7, color: "#d4a843", weight: 2.5, fillColor: "#d4a843", fillOpacity: strong ? 1 : 0 })
        .on("click", () => setSel(p.id)).bindTooltip(`${p.name} · ${p.score}`));
    }
    map.addLayer(g);
    clusterRef.current = g;
    const glow = glowRef.current;
    glow?.clearLayers();
    for (const p of shown.filter((x) => x.late && x.score >= 70).slice(0, 60)) L.circleMarker([p.lat, p.lon], { radius: 24, stroke: false, fillColor: "#ff6400", fillOpacity: 0.2, interactive: false }).addTo(glow!);
    return () => { map.removeLayer(g); };
  }, [ready, shown.map((p) => p.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // selection and hover rings sit above the clusters, so a pin inside a cluster still shows
  useEffect(() => {
    const L = LRef.current, ring = ringRef.current;
    if (!ready || !L || !ring) return;
    ring.clearLayers();
    const s = current && byId.get(current.id);
    if (s) L.circleMarker([s.lat, s.lon], { radius: 13, color: "#ffffff", weight: 3, fill: false, interactive: false }).addTo(ring);
    const h = hover ? byId.get(hover) : null;
    if (h) L.circleMarker([h.lat, h.lon], { radius: 17, color: "#ff6400", weight: 4, fillColor: "#d4a843", fillOpacity: 0.5, interactive: false }).addTo(ring);
  }, [ready, current?.id, hover]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === "map") setTimeout(() => mapRef.current?.invalidateSize(), 50); }, [tab]);

  function pickFromList(p: Pin) {
    setSel(p.id);
    const map = mapRef.current;
    if (map) map.setView([p.lat, p.lon], Math.max(map.getZoom(), 15));
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setStatus("Looking up the place.");
    try {
      const r = await fetch("/api/place?q=" + encodeURIComponent(q));
      const j = (await r.json()) as { ok: boolean; place?: { slug: string }; error?: string };
      if (!j.ok || !j.place) { setStatus(j.error ?? "No place found for that search."); setBusy(false); return; }
      router.push(`/scout?place=${j.place.slug}`);
      setStatus("");
    } catch { setStatus("The place search did not answer. Try again in a moment."); }
    setBusy(false);
  }

  async function scan() {
    setBusy(true);
    const failed: string[] = [];
    let i = 0;
    for (const c of ALL_CATEGORIES) {
      i++;
      setStatus(`Asking OpenStreetMap for ${CAT_NAME[c].toLowerCase()} (${i} of ${ALL_CATEGORIES.length}).`);
      try {
        const r = await fetch(`/api/scout?place=${place.slug}&cat=${c}&refresh=1`);
        const j = (await r.json()) as { ok: boolean };
        if (!j.ok) failed.push(CAT_NAME[c]);
      } catch { failed.push(CAT_NAME[c]); }
    }
    setStatus(failed.length ? `${failed.join(", ")} did not load, try again. The rest did.` : "Scan finished. Anything already fresh today came from the saved copy.");
    router.refresh();
    setBusy(false);
  }

  async function top() {
    setBusy(true);
    let n = 0, found = 0, skipped = 0;
    for (const id of top20) {
      n++;
      setStatus(`Reading the website of place ${n} of ${top20.length}. One site at a time.`);
      try {
        const r = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        const j = (await r.json()) as { ok: boolean; count?: number; skipped?: boolean };
        if (j.ok && !j.skipped) found += j.count ?? 0; else skipped++;
      } catch { skipped++; }
    }
    setStatus(`Done. ${found} contacts found on ${top20.length - skipped} sites. Open a prospect to see them.`);
    setBusy(false);
  }

  const dots = (() => {
    const w = 900, h = 760;
    const px = (p: Pt) => ({ x: ((p.lon - bbox.west) / (bbox.east - bbox.west)) * w, y: ((bbox.north - p.lat) / (bbox.north - bbox.south)) * h });
    return shown.slice(0, 300).map((p) => ({ ...px(p), id: p.id, strong: p.score >= 70 }));
  })();

  return (
    <div className="scout" data-tab={tab}>
      <div className="mtabs" role="tablist" aria-label="Map or list">
        <button className={"btn" + (tab === "map" ? " gild" : "")} role="tab" aria-selected={tab === "map"} onClick={() => setTab("map")}>Map</button>
        <button className={"btn" + (tab === "list" ? " gild" : "")} role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")}>List ({inView.length})</button>
      </div>
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
          <span>Numbers are groups. Zoom to split them.</span>
        </div>
      </div>
      <div className="glass list">
        <form className="searchrow" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city or place" aria-label="Search a city or place" />
          <button className="btn" type="submit" disabled={busy}>Search</button>
        </form>
        <div className="rowflex"><h2 style={{ margin: 0 }}>Best prospects</h2><span className="muted small num">{inView.length} in view of {total}</span></div>
        <p className="muted small placeline">{place.name}</p>
        <label className="check muted small"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Search as I move the map</label>
        <div className="actions">
          {current && <Link href={`/prospects/${current.id}`} className="btn gild">Open prospect</Link>}
          <button className="btn" onClick={scan} disabled={busy}>Scan this place</button>
          {top20.length > 0 && <button className="btn" onClick={top} disabled={busy}>Find contacts for the top {top20.length}</button>}
        </div>
        {status && <p className="muted small" role="status">{status}</p>}
        <div className="rows">
          {list.map((p) => (
            <button key={p.id} className={"pro" + (current?.id === p.id ? " sel" : "")} onClick={() => pickFromList(p)} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}>
              <div className="score">{p.score}</div>
              <div>
                <b>{p.name}</b>
                <div className="why">{p.area}</div>
                <div><span className="chip">{CHIP[p.category]}</span>{p.late && <span className="chip">open late</span>}{p.site && <span className="chip">has website</span>}</div>
              </div>
            </button>
          ))}
          {list.length === 0 && <p className="muted">{hasData ? "Nothing in this part of the map. Zoom out or pan." : "No data for this place yet. Press Scan this place to ask OpenStreetMap."}</p>}
        </div>
      </div>
    </div>
  );
}
