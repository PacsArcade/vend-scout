"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { BlockLoader, Ticker } from "./BlockLoader";
import type { Bbox, Category, VenueCategory } from "@/lib/types";
import { ALL_CATEGORIES } from "@/lib/types";
import { STATES } from "@/lib/states";
import { cellOf, cellCorners, cellsInView, resForView, ringOf, AREA_RES } from "@/lib/areas";
import { coinSvg, groupSvg, machineSvg, siteSvg } from "@/lib/hexart";
import { HexMark } from "./Hex";

export type { Pin } from "@/lib/pins";
import type { Pin } from "@/lib/pins";
type Pt = { lat: number; lon: number };
export type OursPt = Pt & { btc: boolean };
export type JobPin = { id: string; kind: string; title: string; detail: string; sats: number; lat: number; lon: number; coin: boolean };
const JOB_LABEL: Record<string, string> = { restock: "Restock", scout: "Scout visit", shelf: "Shelf pickup", tech: "Repair" };
type View = { s: number; w: number; n: number; e: number };

const FILTERS: { key: VenueCategory; label: string }[] = [
  { key: "laundry", label: "Laundromats" },
  { key: "gym", label: "Gyms" },
  { key: "car_wash", label: "Car washes" },
  { key: "car_repair", label: "Auto shops" },
];
const CHIP: Record<VenueCategory, string> = { laundry: "laundromat", gym: "gym", car_wash: "car wash", car_repair: "auto shop" };
const CAT_NAME: Record<Category, string> = { laundry: "Laundromats", gym: "Gyms", car_wash: "Car washes", car_repair: "Auto shops", vending: "Vending machines", convenience: "Convenience shops", fast_food: "Fast food" };

export function ScoutClient({ place, bbox, pins: pinsProp, existing, ours, jobs, total, hasData, top20, initialView, initialTab, initialMode, cities, operator, demoDrop, copyStamp }: { place: { slug: string; name: string }; bbox: Bbox; pins: Pin[]; existing: Pt[]; ours: OursPt[]; jobs: JobPin[]; total: number; hasData: boolean; top20: string[]; initialView?: { lat: number; lon: number; zoom: number }; initialTab: "map" | "list"; initialMode: "pins" | "areas"; cities: { slug: string; name: string; scanned: boolean }[]; operator: boolean; demoDrop?: boolean; copyStamp?: string }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<string, boolean>>({ laundry: true, gym: true, car_wash: true, car_repair: true });
  const [lateOnly, setLateOnly] = useState(false);
  const lastTotal = useRef(0);
  const [livePins, setLivePins] = useState<Pin[] | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const pins = livePins ?? pinsProp;
  const [sel, setSel] = useState(pinsProp[0]?.id);
  const [hover, setHover] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [view, setView] = useState<View | null>(null);
  const [tab, setTab] = useState<"map" | "list">(initialTab);
  const [mode, setMode] = useState<"pins" | "areas">(initialMode);
  const [selCell, setSelCell] = useState<string | null>(null);
  
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [tilesOk, setTilesOk] = useState(true);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const clusterRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const gridRef = useRef<Leaflet.LayerGroup | null>(null);
  const ringRef = useRef<Leaflet.LayerGroup | null>(null);
  const areaRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  const [demoOn, setDemoOn] = useState(false);
  const [landed, setLanded] = useState<Partial<Record<Category, number>>>({});
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState("");
  const [foundCount, setFoundCount] = useState<number | null>(null);
  const loading = busy || demoOn;
  // Elapsed seconds while a scan (or the demo replay) runs.
  useEffect(() => {
    if (!loading) return;
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [loading]);
  // Proof only (VEND_DEMO_DROP=1 and ?demoDrop=1): replay the saved pins landing kind by kind, so the drop can be seen without a live scan.
  useEffect(() => {
    if (!demoDrop) return;
    const order: Pin["category"][] = ["laundry", "gym", "car_wash", "car_repair"];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    let k = 0; setDemoOn(true); setLivePins([]); setFoundCount(null); setLanded({});
    const t = setInterval(() => {
      const have = order.slice(0, ++k);
      const batch = pinsProp.filter((p) => p.category === order[k - 1]);
      setLivePins(pinsProp.filter((p) => have.includes(p.category)));
      setFresh(batch.map((p) => p.id));
      setLanded((l) => ({ ...l, [order[k - 1]]: batch.length }));
      if (k >= order.length) { clearInterval(t); setDemoOn(false); setFoundCount(pinsProp.length); }
    }, 900);
    return () => clearInterval(t);
  }, [demoDrop]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = pins.filter((p) => on[p.category] && (!lateOnly || p.late));
  const inView = follow && view ? shown.filter((p) => p.lat >= view.s && p.lat <= view.n && p.lon >= view.w && p.lon <= view.e) : shown;
  const list = inView.slice(0, 15);
  const current = shown.find((p) => p.id === sel) ?? inView[0] ?? shown[0];
  const byId = new Map(pins.map((p) => [p.id, p]));

  useEffect(() => {
    let dead = false;
    let ro: ResizeObserver | null = null;
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
      gridRef.current = L.layerGroup().addTo(map);
      areaRef.current = L.layerGroup().addTo(map);
      ringRef.current = L.layerGroup().addTo(map);
      const sync = () => { if (!mapEl.current || mapEl.current.clientWidth < 50) return; const b = map.getBounds(); setView({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }); };
      map.on("moveend", sync);
      sync();
      if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(mapEl.current); }
      mapRef.current = map;
      setReady(true);
    })();
    return () => { dead = true; ro?.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
  }, [bbox]); // eslint-disable-line react-hooks/exhaustive-deps

  const hexIcon = (L: typeof Leaflet, html: string, size: number, cls = "") => L.divIcon({ className: "hexpin " + cls, html: `<span>${html}</span>`, iconSize: [size + 16, size + 16], iconAnchor: [(size + 16) / 2, (size + 16) / 2] });

  // machines: other people's are small grey hexagons in groups; ours are filled hexagons, a coin with the B mark when it takes bitcoin
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map || mode !== "pins") return;
    const g = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45, disableClusteringAtZoom: 15, showCoverageOnHover: false,
      iconCreateFunction: (c) => L.divIcon({ html: groupSvg(36, c.getChildCount(), "#8a9bb0"), className: "hexpin", iconSize: [36, 36] }) });
    for (const m of existing) g.addLayer(L.marker([m.lat, m.lon], { icon: hexIcon(L, machineSvg(20, "#8a9bb0"), 20), keyboard: false }));
    map.addLayer(g);
    const mine = L.layerGroup();
    for (const m of ours) L.marker([m.lat, m.lon], { icon: hexIcon(L, m.btc ? coinSvg(30) : machineSvg(30, "#00ffff"), 30), title: m.btc ? "Our machine, takes bitcoin" : "Our machine", zIndexOffset: 500 }).bindTooltip(m.btc ? "Our machine, takes bitcoin" : "Our machine").addTo(mine);
    map.addLayer(mine);
    return () => { map.removeLayer(g); map.removeLayer(mine); };
  }, [ready, existing, ours, mode]);

  // prospects: dotted hexagons, in hexagon groups with a count that split as you zoom
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map || mode !== "pins") return;
    const g = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 55, disableClusteringAtZoom: 16, showCoverageOnHover: false,
      iconCreateFunction: (c) => L.divIcon({ html: groupSvg(40, c.getChildCount()), className: "hexpin", iconSize: [40, 40] }) });
    for (const p of shown) {
      const strong = p.score >= 70;
      g.addLayer(L.marker([p.lat, p.lon], { icon: hexIcon(L, siteSvg(strong ? 32 : 24), strong ? 32 : 24, fresh.includes(p.id) ? "droppin" : ""), keyboard: false }).on("click", () => setSel(p.id)).bindTooltip(`${p.name}, fit ${p.score} of 100`));
    }
    map.addLayer(g);
    clusterRef.current = g;
    return () => { map.removeLayer(g); };
  }, [ready, mode, shown.map((p) => p.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // the true H3 grid under everything (pins view). Resolution follows the zoom so the cells stay a readable size.
  const gridRes = view ? resForView(view) : 9;
  useEffect(() => {
    const L = LRef.current, g = gridRef.current;
    if (!ready || !L || !g) return;
    g.clearLayers();
    if (!view || mode !== "pins") return;
    for (const c of cellsInView(view, gridRes, 700)) L.polygon(cellCorners(c), { color: "#ffffff", opacity: 0.16, weight: 1, fill: false, interactive: false }).addTo(g);
  }, [ready, mode, view, gridRes]);

  // the selected pin sits in its own cell: the cell is outlined in cyan. Hover draws the row's cell in orange.
  useEffect(() => {
    const L = LRef.current, ring = ringRef.current;
    if (!ready || !L || !ring) return;
    ring.clearLayers();
    if (mode !== "pins") return;
    const s = current && byId.get(current.id);
    const sc = s ? cellOf(s.lat, s.lon, gridRes) : null;
    if (sc) L.polygon(cellCorners(sc), { color: "#00ffff", weight: 4, fillColor: "#00ffff", fillOpacity: 0.14, interactive: false }).addTo(ring);
    const h = hover ? byId.get(hover) : null;
    const hc = h ? cellOf(h.lat, h.lon, gridRes) : null;
    if (hc && hc !== sc) L.polygon(cellCorners(hc), { color: "#f7931a", weight: 3, fillOpacity: 0, interactive: false }).addTo(ring);
  }, [ready, mode, current?.id, hover, gridRes]); // eslint-disable-line react-hooks/exhaustive-deps

  // areas view: H3 resolution 7. Open jobs per area, the number in each cell, the selected area solid, its ring of six dashed.
  const jobCells = useMemo(() => { const m = new Map<string, JobPin[]>(); for (const j of jobs) { const c = cellOf(j.lat, j.lon, AREA_RES); if (c) m.set(c, [...(m.get(c) ?? []), j]); } return m; }, [jobs]);
  const areaCells = useMemo(() => (mode === "areas" && view ? cellsInView(view, AREA_RES, 900) : []), [mode, view]);
  const chosen = selCell ?? ([...jobCells.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? null);
  const zone = useMemo(() => (chosen ? new Set([chosen, ...ringOf(chosen)]) : new Set<string>()), [chosen]);
  useEffect(() => {
    const L = LRef.current, g = areaRef.current, map = mapRef.current;
    if (!ready || !L || !g || !map) return;
    g.clearLayers();
    if (mode !== "areas") return;
    for (const c of areaCells) {
      const n = jobCells.get(c)?.length ?? 0;
      const sel = c === chosen, inRing = !sel && zone.has(c);
      const poly = L.polygon(cellCorners(c), { color: sel ? "#00ffff" : inRing ? "#00ffff" : "#4d5257", weight: sel ? 4 : inRing ? 2 : 1, dashArray: inRing ? "7 6" : undefined, fillColor: n === 0 ? "#1f1f1f" : "#f7931a", fillOpacity: n === 0 ? 0.55 : Math.min(0.75, 0.22 + n * 0.12) }).on("click", () => setSelCell(c)).addTo(g);
      if (sel) poly.bringToFront();
      if (n > 0 || zone.has(c) || areaCells.length <= 60) { const [la, lo] = (() => { const k = cellCorners(c); return [k.reduce((a, q) => a + q[0], 0) / k.length, k.reduce((a, q) => a + q[1], 0) / k.length]; })(); L.marker([la, lo], { icon: L.divIcon({ className: "hexlabel" + (n === 0 ? " zero" : ""), html: `<b>${n}</b>`, iconSize: [30, 30], iconAnchor: [15, 15] }), interactive: false, keyboard: false }).addTo(g); }
    }
  }, [ready, mode, areaCells, jobCells, chosen, zone]);
  // Areas are size 7 cells (about 1.2 km across a side): zoom in to where they are readable, on the busiest area.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || mode !== "areas" || map.getZoom() >= 11) return;
    const c = chosen ? cellCorners(chosen) : null;
    const at: [number, number] = c ? [c.reduce((a, q) => a + q[0], 0) / c.length, c.reduce((a, q) => a + q[1], 0) / c.length] : [map.getCenter().lat, map.getCenter().lng];
    map.setView(at, 12);
  }, [ready, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setTimeout(() => mapRef.current?.invalidateSize(), 60); }, [mode]);
  useEffect(() => { if (tab === "map") setTimeout(() => mapRef.current?.invalidateSize(), 50); }, [tab]);

  function pickFromList(p: Pin) {
    setSel(p.id);
    const map = mapRef.current;
    if (map) map.setView([p.lat, p.lon], Math.max(map.getZoom(), 15));
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() && !st) return;
    setBusy(true); setStatus("Looking up the place.");
    try {
      const r = await fetch("/api/place?q=" + encodeURIComponent(q) + (st ? "&state=" + st : ""));
      const j = (await r.json()) as { ok: boolean; place?: { slug: string }; error?: string };
      if (!j.ok || !j.place) { setStatus(j.error ?? "No place found for that search."); setBusy(false); return; }
      router.push(`/scout?place=${j.place.slug}`);
      setStatus("");
    } catch { setStatus("The place search did not answer. Try again in a moment."); }
    setBusy(false);
  }

  /** Pull the pins again and let the new ones drop in. Never blocks: the map and list stay usable while it runs. */
  async function pullPins() {
    try {
      const r = await fetch(`/api/scout/pins?place=${place.slug}`, { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; pins: Pin[] };
      if (!j.ok) return;
      lastTotal.current = j.pins.length;
      setLivePins((prev) => {
        const have = new Set((prev ?? pinsProp).map((p) => p.id));
        const added = j.pins.filter((p) => !have.has(p.id)).map((p) => p.id);
        if (added.length) { setFresh(added); setTimeout(() => setFresh([]), 1800); }
        return j.pins;
      });
    } catch { /* the next category tries again */ }
  }

  async function scan() {
    setBusy(true); setLanded({}); setElapsed(0); setNote(""); setFoundCount(null);
    setStatus("");
    const failed: string[] = [], errs: string[] = [];
    let streamed = false, how = "", notLoaded = false;
    try {
      const res = await fetch(`/api/scout/stream?place=${place.slug}`);
      if (res.status === 429) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus(j?.error ?? "That is the limit of new places for now. Try again in a little while."); setBusy(false); return;
      }
      if (res.status === 503) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus(j?.error ?? "Storage is not connected."); setBusy(false); return;
      }
      if (res.ok && res.body) {
        streamed = true;
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as { notLoaded?: boolean; t: string; c?: Category; count?: number; msg?: string; usedUnion?: boolean; source?: string; stamp?: string; failed?: string[]; errors?: string[] };
            if (ev.t === "note") setNote(ev.msg ?? "");
            if (ev.t === "cat") { setNote(""); setLanded((l) => ({ ...l, [ev.c as Category]: ev.count ?? 0 })); await pullPins(); }
            if (ev.t === "done" && ev.notLoaded) { setStatus("This area is not loaded yet. We have not built the data for it, and only an operator can fetch it live."); notLoaded = true; }
            if (ev.t === "done") { how = ev.source === "bundle" ? `from our own OpenStreetMap copy, updated ${ev.stamp ?? "recently"}` : ev.usedUnion ? "in one query" : "one kind at a time"; for (const f of ev.failed ?? []) failed.push(CAT_NAME[f as Category] ?? "Some places"); if (ev.errors?.length) errs.push(...ev.errors); }
          }
        }
      }
    } catch { /* fall back below */ }
    if (notLoaded) { setBusy(false); return; }
    if (!streamed && operator) {
      // The stream was not available: ask one kind at a time, as before.
      for (const c of ALL_CATEGORIES) {
        setStatus(`Asking OpenStreetMap for ${CAT_NAME[c].toLowerCase()}.`);
        try {
          const r = await fetch(`/api/scout?place=${place.slug}&cat=${c}&refresh=1`);
          const j = (await r.json()) as { ok: boolean; error?: string };
          if (!j.ok) { failed.push(CAT_NAME[c]); if (j.error) errs.push(`${c}: ${j.error}`); } else await pullPins();
        } catch { failed.push(CAT_NAME[c]); }
      }
    }
    if (failed.length) setStatus(`${failed.join(", ")} did not load, try again.${errs.length ? " Reason: " + errs.slice(0, 2).join(" | ") : ""}`);
    else { setStatus(`Scan finished${how ? `: ${how}` : ""}. Anything already fresh today came from the saved copy.`); { if (lastTotal.current === 0) await pullPins(); setFoundCount(lastTotal.current); } }
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
  const hexPts = (x: number, y: number, r: number) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const zoneJobs = jobs.filter((j) => { const c = cellOf(j.lat, j.lon, AREA_RES); return !!c && zone.has(c); });
  const zoneMachines = ours.filter((m) => { const c = cellOf(m.lat, m.lon, AREA_RES); return !!c && zone.has(c); }).length;
  const zoneSites = shown.filter((p) => { const c = cellOf(p.lat, p.lon, AREA_RES); return !!c && zone.has(c); }).length;
  const near = () => navigator.geolocation?.getCurrentPosition((g) => mapRef.current?.setView([g.coords.latitude, g.coords.longitude], 14), () => setStatus("Location was not shared, so the map stays where it is."));

  return (
    <div className="scout" data-tab={tab}>
      <div className="mtabs" role="tablist" aria-label="Map or list">
        <button className={"btn" + (tab === "map" ? " gild" : "")} role="tab" aria-selected={tab === "map"} onClick={() => setTab("map")}>Map</button>
        <button className={"btn" + (tab === "list" ? " gild" : "")} role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")}>{mode === "areas" ? `Jobs (${zoneJobs.length})` : `List (${inView.length})`}</button>
      </div>
      <div className="glass map">
        <div className="mapbar">
          <div className="seg" role="group" aria-label="Map view">
            <button aria-pressed={mode === "pins"} onClick={() => setMode("pins")}>Pins</button>
            <button aria-pressed={mode === "areas"} onClick={() => setMode("areas")}>Areas</button>
          </div>
          <div className="chips">
          <span className="chip"><HexMark kind="coin" size={20} />Placed machines {ours.length}</span>
          <span className="chip"><HexMark kind="site" size={20} />Potential sites {shown.length}</span>
          <button className="chip" aria-pressed={mode === "areas"} onClick={() => setMode("areas")}>Open jobs {jobs.length}</button>
          <button className="chip" onClick={near}>Near me</button>
          </div>
        </div>
        {mode === "pins" && <div className="filters" aria-label="What to show">
          {FILTERS.map((f) => (
            <button key={f.key} className={"chip" + (on[f.key] ? "" : " off")} onClick={() => setOn({ ...on, [f.key]: !on[f.key] })} aria-pressed={on[f.key]}>{f.label}</button>
          ))}
          <button className={"chip" + (lateOnly ? "" : " off")} onClick={() => setLateOnly(!lateOnly)} aria-pressed={lateOnly}>Open late</button>
        </div>}
        {mode === "areas" && (
          <div className="areahead" role="status">
            <b>{chosen ? "Selected area and its ring" : "No area selected"}</b>
            <span className="dim">{chosen ? `${zoneJobs.length} open job${zoneJobs.length === 1 ? "" : "s"}. ${zoneMachines} placed machine${zoneMachines === 1 ? "" : "s"}. ${zoneSites} potential site${zoneSites === 1 ? "" : "s"}.` : "Tap a hexagon on the map."}</span>
          </div>
        )}
        <div className="leafwrap">
          <div ref={mapEl} className="leaf" />
          {!tilesOk && (
            <svg className="fallback" viewBox="0 0 900 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Fallback map, tiles did not load">
              <rect width="900" height="760" fill="#1b1b1b" />
              {dots.map((d) => <polygon key={d.id} points={hexPts(d.x, d.y, d.strong ? 11 : 8)} fill="none" stroke="#f7931a" strokeWidth="2.5" strokeDasharray="3 4" onClick={() => setSel(d.id)} />)}
            </svg>
          )}
        </div>
        {mode === "pins" ? (
          <div className="legend">
            <span><HexMark kind="site" size={20} />Potential site: dotted hexagon</span>
            <span><HexMark kind="coin" size={20} />Machine with bitcoin: hexagon coin</span>
            <span><HexMark kind="machine" size={20} />Machine: filled hexagon</span>
            <span className="flipnote"><HexMark kind="site" size={22} /><HexMark kind="machine" size={22} /><span><b>Before and after.</b> When the host says yes, the dotted hexagon flips to a filled one. Numbers in a hexagon are groups.</span></span>
          </div>
        ) : (
          <div className="legend">
            <span>Open jobs per area (H3 size {AREA_RES}). The number in each hexagon is the count.</span>
            <span>Selected area: solid line</span>
            <span>Its ring of six: dashed line</span>
            <span>Orange fill: more open jobs</span>
          </div>
        )}
      </div>
      <div className="glass list">
        {mode === "areas" ? (
          <>
            <div className="panelhead"><h2>Jobs in this area</h2><span className="pill">{zoneJobs.length} open</span></div>
            <div className="panelbody">
              <div className="rows">
                {zoneJobs.map((j) => (
                  <div key={j.id} className="notch jobrow">
                    <span className="ic"><HexMark kind={j.kind === "scout" ? "site" : j.coin ? "coin" : "machine"} size={28} /></span>
                    <div><b>{JOB_LABEL[j.kind] ?? j.kind}: {j.title.replace(/^(Restock|Repair|Visit and pitch|Pitch|Shelf pickup:?)\s*/i, "")}</b><div className="why">{j.detail}</div></div>
                    <div className="side"><span className="sats num">{j.kind === "scout" ? "Paid in parts" : `${j.sats.toLocaleString("en-US")} sats`}</span><Link className="btn" href="/jobs">Claim</Link></div>
                  </div>
                ))}
                {zoneJobs.length === 0 && <p className="muted">{jobs.length === 0 ? "No open jobs right now. Jobs show up when a machine runs low, a site waits for a pitch, or a machine needs repair." : "No open jobs in this area or its ring. Tap another hexagon."}</p>}
              </div>
              <p className="hint2">Claiming happens on the Jobs page, where your crew name is checked. Only people on the crew can claim.</p>
            </div>
          </>
        ) : (
        <>
        <div className="panelhead"><h2>Best prospects</h2><span className="pill num">{inView.length} in view of {total}</span></div>
        <div className="panelbody">
        <form className="searchrow" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City or place" aria-label="Search a city or place" />
          <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="State to search in" className="statepick">
            <option value="">Any state</option>
            {STATES.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
          <button className="btn" type="submit" disabled={busy}>Search</button>
        </form>
        <label className="runpick regionpick"><span>Illinois, Chicago first</span>
          <select value={cities.some((c) => c.slug === place.slug) ? place.slug : ""} onChange={(e) => e.target.value && router.push(`/scout?place=${e.target.value}`)} aria-label="Illinois city">
            {!cities.some((c) => c.slug === place.slug) && <option value="">{place.name}</option>}
            {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}{c.scanned ? "" : " (not scanned yet)"}</option>)}
          </select>
        </label>
        <p className="muted small placeline">{place.name}</p>
        {copyStamp && <p className="muted small copyline">From our own OpenStreetMap copy, updated {copyStamp}.</p>}
        <p className="muted small copyline">Place data © OpenStreetMap contributors, ODbL.</p>
        {loading && <BlockLoader landed={landed} elapsed={elapsed} note={note} />}
        {!loading && foundCount !== null && <p className="foundcount num" role="status" aria-live="polite"><Ticker value={foundCount} /> places found</p>}
        <label className="check muted small"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Search as I move the map</label>
        <div className="actions">
          {operator && current && <Link href={`/prospects/${current.id}`} className={"btn" + (hasData ? " gild" : "")}>Open prospect</Link>}
          <button className={"btn" + (hasData ? "" : " gild")} onClick={scan} disabled={busy}>{operator ? "Scan this place" : "Load this place"}</button>
          {operator && top20.length > 0 && <button className="btn" onClick={top} disabled={busy}>Find contacts for the top {top20.length}</button>}
        </div>
        {!hasData && (operator
          ? <p className="scanhint">This place has no scan yet. Press Scan this place and it fills in a few minutes.</p>
          : <p className="scanhint">This place is not loaded yet. Press Load this place to fetch it from our own map data. <Link href="/signin?next=/scout" className="small">Operator sign in</Link></p>)}
        {status && <p className="muted small" role="status">{status}</p>}
        <div className="rows">
          {list.map((p, i) => (
            <button key={p.id} style={fresh.includes(p.id) ? { animationDelay: `${Math.min(i, 8) * 70}ms` } : undefined} className={"pro" + (current?.id === p.id ? " sel" : "") + (fresh.includes(p.id) ? " drop" : "")} onClick={() => pickFromList(p)} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}>
              <span className="ic"><HexMark kind="site" size={30} /></span>
              <span><b>{p.name}</b><span className="why">{p.area}</span></span>
              <span className="side">{current?.id === p.id ? <span className="pill cy">Selected</span> : p.checked ? <span className="pill pur">Scout checked</span> : <span />}<span className={"num" + (fresh.includes(p.id) && p.score >= 85 ? " scorepop" : "")}>Fit {p.score} of 100</span></span>
              <span className="chiprow"><span className="chip">{CHIP[p.category]}</span>{p.late && <span className="chip">open late</span>}{p.site && <span className="chip">has website</span>}</span>
            </button>
          ))}
          {list.length === 0 && hasData && <p className="muted">Nothing in this part of the map. Zoom out or pan.</p>}
        </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
