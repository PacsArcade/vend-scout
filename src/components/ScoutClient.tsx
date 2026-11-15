"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { BlockLoader, Ticker } from "./BlockLoader";
import type { Bbox, Category, VenueCategory } from "@/lib/types";
import { ALL_CATEGORIES } from "@/lib/types";
import { STATES } from "@/lib/states";
import { cellOf, cellCorners, cellsInView, ringOf, AREA_RES } from "@/lib/areas";
import { HexMark } from "./Hex";
import { btcMarkHtml, coinSvg, machineSvg, ringSvg, siteSpotSvg } from "@/lib/hexart";
import { fanOut, fittedChildren, levelFor, MARK_PX, shrink, type FittedChild } from "@/lib/hexlevels";
import { LEAFLET_CREDIT, OSM_CREDIT, OSM_TILES } from "@/lib/mapcredit";
import { cellCentre, groupByCell, innerHex, MARK_SCALE, GRID_FINEST, resForPixels } from "@/lib/hexcells";
import { cellToParent, getHexagonEdgeLengthAvg } from "h3-js";
import { PinCard, type CardItem, type CardTarget, type OursPt } from "./PinCard";

export type { Pin } from "@/lib/pins";
import type { Pin } from "@/lib/pins";
type Pt = { lat: number; lon: number };
export type { OursPt };
export type JobPin = { id: string; kind: string; title: string; detail: string; sats: number; lat: number; lon: number; coin: boolean };
const JOB_LABEL: Record<string, string> = { restock: "Restock", scout: "Scout visit", shelf: "Shelf pickup", tech: "Repair" };
type View = { s: number; w: number; n: number; e: number; wpx: number };
/** What sits in a grid cell on the pins view: a store, one of our machines, or someone else's machine from OpenStreetMap. */
type Thing = { kind: "store"; pin: Pin; lat: number; lon: number } | { kind: "machine"; m: OursPt; lat: number; lon: number } | { kind: "other"; lat: number; lon: number };
const ORANGE = "#f7931a", CYAN = "#00ffff", GREY = "#8a9bb0";
const itemAt = (it: CardItem) => (it.kind === "store" ? it.pin : it.m);
const targetAt = (t: CardTarget) => (t.kind === "cell" ? itemAt(t.items[0]) : t.kind === "others" ? t : itemAt(t));
/** r26: one key per store or machine on the map, for the selection ring and for giving focus back when the card closes. */
const thingKey = (t: { kind: "store"; pin: Pin } | { kind: "machine"; m: OursPt } | { kind: "other"; lat: number; lon: number }) => (t.kind === "store" ? "s:" + t.pin.id : t.kind === "machine" ? "m:" + t.m.id : `o:${t.lat},${t.lon}`);
const cardThingKey = (c: CardTarget): string => (c.kind === "cell" ? cardThingKey(c.items[0]) : c.kind === "others" ? `o:${c.lat},${c.lon}` : c.kind === "store" ? "s:" + c.pin.id : "m:" + c.m.id);

const FILTERS: { key: VenueCategory; label: string }[] = [
  { key: "laundry", label: "Laundromats" },
  { key: "gym", label: "Gyms" },
  { key: "car_wash", label: "Car washes" },
  { key: "car_repair", label: "Auto shops" },
];
const CHIP: Record<VenueCategory, string> = { laundry: "laundromat", gym: "gym", car_wash: "car wash", car_repair: "auto shop" };
const CAT_NAME: Record<Category, string> = { laundry: "Laundromats", gym: "Gyms", car_wash: "Car washes", car_repair: "Auto shops", vending: "Vending machines", convenience: "Convenience shops", fast_food: "Fast food" };

export function ScoutClient({ place, bbox, pins: pinsProp, existing, ours, jobs, total, hasData, top20, initialView, initialTab, initialMode, cities, operator, mailOn = false, demoDrop, copyStamp }: { place: { slug: string; name: string }; bbox: Bbox; pins: Pin[]; existing: Pt[]; ours: OursPt[]; jobs: JobPin[]; total: number; hasData: boolean; top20: string[]; initialView?: { lat: number; lon: number; zoom: number }; initialTab: "map" | "list"; initialMode: "pins" | "areas"; cities: { slug: string; name: string; scanned: boolean }[]; operator: boolean; mailOn?: boolean; demoDrop?: boolean; copyStamp?: string }) {
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
  const markRef = useRef<Leaflet.LayerGroup | null>(null);
  // r26: where each store or machine was drawn, so the selection ring and the pan can find it: a spot (real or fanned) or a small hexagon (a count)
  const drawnAt = useRef(new Map<string, { at?: [number, number]; poly?: [number, number][] }>());
  const cardRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<CardTarget | null>(null);
  const openerCell = useRef<string | null>(null);
  const [wide, setWide] = useState(false);
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
      if (dead || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true });
      map.attributionControl.setPrefix(LEAFLET_CREDIT); // r26: no flag beside the Leaflet name
      if (initialView) map.setView([initialView.lat, initialView.lon], initialView.zoom);
      else map.fitBounds([[bbox.south, bbox.west], [bbox.north, bbox.east]]);
      let loaded = 0, failed = 0;
      const tiles = L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_CREDIT });
      tiles.on("tileload", () => { loaded++; });
      tiles.on("tileerror", () => { failed++; if (failed >= 6 && loaded === 0) setTilesOk(false); });
      tiles.addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      gridRef.current = L.layerGroup().addTo(map);
      areaRef.current = L.layerGroup().addTo(map);
      ringRef.current = L.layerGroup().addTo(map);
      markRef.current = L.layerGroup().addTo(map);
      // a tap on the bare map closes the card. Taps on a mark stop before they reach the map.
      map.on("click", () => closeRef.current());
      const sync = () => { if (!mapEl.current || mapEl.current.clientWidth < 50) return; const b = map.getBounds(); setView({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), wpx: mapEl.current.clientWidth }); };
      map.on("moveend", sync);
      sync();
      if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(() => map.invalidateSize()); ro.observe(mapEl.current); }
      mapRef.current = map;
      setReady(true);
    })();
    return () => { dead = true; ro?.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
  }, [bbox]); // eslint-disable-line react-hooks/exhaustive-deps

  // the true H3 grid under everything (pins view). Resolution follows the zoom so the cells stay a readable size.
  const mpp = view ? ((view.e - view.w) * 111_320 * Math.cos((((view.n + view.s) / 2) * Math.PI) / 180)) / view.wpx : NaN;
  const gridRes = resForPixels(mpp);
  const markPx = Number.isFinite(mpp) ? ((2 * getHexagonEdgeLengthAvg(gridRes, "m")) / mpp) * MARK_SCALE : 48;

  // ---- r23: the card a pin tap opens, and the marks drawn inside their grid cells ----
  const closeCard = useCallback(() => {
    setCard((c) => {
      if (c && openerCell.current) { const cell = openerCell.current; setTimeout(() => (mapEl.current?.querySelector(`[data-cell="${cell}"]`) as HTMLElement | SVGElement | null)?.focus(), 0); }
      return null;
    });
  }, []);
  const closeRef = useRef(closeCard);
  useEffect(() => { const q = window.matchMedia("(min-width: 901px)"); const f = () => setWide(q.matches); f(); q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, []);
  useEffect(() => {
    if (!card) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") closeCard(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [card, closeCard]);
  const openItem = useCallback((it: CardItem) => { setCard(it); if (it.kind === "store") setSel(it.pin.id); }, []);
  // Pan so the selected hexagon sits in the clear map above the card.
  const cardKey = card ? (card.kind === "cell" ? "cell:" + card.items.length + ":" + targetAt(card).lat : card.kind === "store" ? card.pin.id : card.kind === "others" ? `others:${card.lat},${card.lon}` : card.m.id) : "";
  useEffect(() => {
    const map = mapRef.current, el = cardRef.current, box = mapEl.current;
    if (!card || !map || !el || !box) return;
    const id = requestAnimationFrame(() => {
      // r26: a mark that fanned out is drawn a little off its real spot; pan to where it is drawn
      const d = drawnAt.current.get(cardThingKey(card))?.at, at = d ? { lat: d[0], lon: d[1] } : targetAt(card), pt = map.latLngToContainerPoint([at.lat, at.lon]);
      const room = box.clientHeight - el.offsetHeight - 16, w = box.clientWidth;
      const dy = pt.y - Math.max(markPx / 2 + 8, room / 2), dx = pt.x < 40 || pt.x > w - 40 ? pt.x - w / 2 : 0;
      if (Math.abs(dy) > 8 || dx) map.panBy([dx, dy], { animate: true });
    });
    return () => cancelAnimationFrame(id);
  }, [cardKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const things = useMemo<Thing[]>(() => [
    ...existing.map((m) => ({ kind: "other" as const, lat: m.lat, lon: m.lon })),
    ...shown.map((p) => ({ kind: "store" as const, pin: p, lat: p.lat, lon: p.lon })),
    ...ours.map((m) => ({ kind: "machine" as const, m, lat: m.lat, lon: m.lon })),
  ], [existing, ours, shown.map((p) => p.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  // r26, hexagon round 3. Three levels (src/lib/hexlevels.ts):
  //   building (finest grid): every store and machine stands on its real spot; marks too close for a thumb fan out on spider lines.
  //   levels (one out): seven whole small hexagons inside each bold border; a thing alone keeps its real spot, several are a count in the middle.
  //   cells (further out): as before, each mark the shape of its grid cell shrunk to MARK_SCALE, a count in the middle.
  const level = levelFor(gridRes);
  useEffect(() => {
    const L = LRef.current, g = markRef.current, map = mapRef.current;
    if (!ready || !L || !g || !map) return;
    g.clearLayers();
    drawnAt.current = new Map();
    if (mode !== "pins" || !view) return;
    const padLat = (view.n - view.s) * 0.3, padLon = (view.e - view.w) * 0.3;
    const near = things.filter((t) => t.lat >= view.s - padLat && t.lat <= view.n + padLat && t.lon >= view.w - padLon && t.lon <= view.e + padLon);
    const font = Math.round(Math.max(13, Math.min(24, markPx * 0.42)));
    const label = (at: [number, number], text: string, ink: string) => L.marker(at, { icon: L.divIcon({ className: "hexlabel2", html: `<b style="font-size:${font}px;color:${ink}">${text}</b>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(g);
    const keyboard = (el: Element | undefined, key: string, name: string, pick: () => void) => {
      if (!el) return;
      el.setAttribute("tabindex", "0"); el.setAttribute("role", "button"); el.setAttribute("aria-label", name); el.setAttribute("data-cell", key);
      el.addEventListener("keydown", (e) => { const k = (e as KeyboardEvent).key; if (k === "Enter" || k === " ") { e.preventDefault(); pick(); } });
    };
    const nameOf = (t: Thing) => t.kind === "store" ? `${t.pin.name}, potential site${operator ? `, fit ${t.pin.score} of 100` : ""}` : t.kind === "machine" ? `${t.m.name}, our machine${t.m.btc ? ", takes bitcoin" : ""}` : "1 vending machine by another operator";
    // a cell holding several things: the card for them, or a zoom in when a finer grid splits them
    const pickCell = (cell: string, real: Exclude<Thing, { kind: "other" }>[], drawn: Thing[], at: [number, number]) => {
      openerCell.current = cell;
      // r24: a cell of only other operators' machines opens a facts-only card with the count
      if (real.length === 0) { setCard({ kind: "others", count: drawn.length, lat: at[0], lon: at[1] }); return; }
      if (real.length === 1) openItem(real[0].kind === "store" ? { kind: "store", pin: real[0].pin } : { kind: "machine", m: real[0].m });
      else if (gridRes < GRID_FINEST) { closeRef.current(); map.setView(at, Math.min(19, map.getZoom() + 2)); } // a finer grid splits the group
      else setCard({ kind: "cell", items: real.map((t) => (t.kind === "store" ? { kind: "store", pin: t.pin } : { kind: "machine", m: t.m })) });
    };
    const countPoly = (corners: [number, number][], allOther: boolean) => L.polygon(corners, { color: allOther ? GREY : ORANGE, weight: 2.4, fillColor: "#262626", fillOpacity: 0.95, className: "mark" });

    if (level === "cells") {
      // ---- zoomed out: unchanged. Every mark is the shape of its own grid cell, shrunk around the centre; several make one count. ----
      for (const { cell, items } of groupByCell(near, gridRes)) {
        const corners = innerHex(cell);
        // Stores and our machines own a cell. Other people's machines (OpenStreetMap) only show in a cell that has none of ours, so they never hide a store.
        const real = items.filter((t): t is Exclude<Thing, { kind: "other" }> => t.kind !== "other");
        const drawn: Thing[] = real.length ? real : items;
        const one = drawn.length === 1 ? drawn[0] : null;
        const allOther = real.length === 0;
        let poly: Leaflet.Polygon;
        if (one?.kind === "other") {
          poly = L.polygon(corners, { color: "#111", weight: 1, fillColor: GREY, fillOpacity: 0.85, className: "mark" });
        } else if (one?.kind === "store") {
          const fresh1 = fresh.includes(one.pin.id);
          poly = L.polygon(corners, { color: ORANGE, weight: one.pin.score >= 70 ? 3.2 : 2.4, dashArray: "2 7", lineCap: "round", fillColor: "#1b1b1b", fillOpacity: 0.35, className: "mark" + (fresh1 ? " droppin" : "") });
        } else if (one?.kind === "machine") {
          poly = L.polygon(corners, { color: "#111", weight: 1.5, fillColor: one.m.btc ? ORANGE : CYAN, fillOpacity: 1, className: "mark" });
          if (one.m.btc) L.marker(cellCentre(cell), { icon: L.divIcon({ className: "hexlabel2", html: btcMarkHtml(markPx), iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(g);
        } else {
          poly = countPoly(corners, allOther);
          label(cellCentre(cell), String(drawn.length), "#fff");
        }
        const name = one ? nameOf(one) : allOther ? `${drawn.length} vending machines by other operators` : `${drawn.length} places in this hexagon`;
        const pick = () => pickCell(cell, real, drawn, cellCentre(cell));
        poly.on("click", (e) => { L.DomEvent.stopPropagation(e); pick(); }).addTo(g);
        keyboard(poly.getElement(), cell, name, pick);
        for (const t of real) drawnAt.current.set(thingKey(t), { poly: cellCorners(cell) });
      }
      return;
    }

    // ---- one level out and all the way in ----
    const singles: Thing[] = [];
    const fitted = new Map<string, FittedChild>();
    const fitFor = (cell: string) => {
      if (!fitted.has(cell)) for (const k of fittedChildren(cellToParent(cell, gridRes - 1), gridRes)) fitted.set(k.cell, k);
      return fitted.get(cell);
    };
    for (const { cell, items } of groupByCell(near, gridRes)) {
      const real = items.filter((t): t is Exclude<Thing, { kind: "other" }> => t.kind !== "other");
      const drawn: Thing[] = real.length ? real : items;
      if (level === "building" || drawn.length === 1) { singles.push(...drawn); continue; }
      // several in one small hexagon: a count in its middle (the count stands for the whole small hexagon)
      const f = fitFor(cell);
      const centre = f?.centre ?? cellCentre(cell);
      const allOther = real.length === 0;
      const poly = countPoly(f ? shrink(f.corners, f.centre, 0.62) : innerHex(cell), allOther);
      label(centre, String(drawn.length), "#fff");
      const pick = () => pickCell(cell, real, drawn, centre);
      poly.on("click", (e) => { L.DomEvent.stopPropagation(e); pick(); }).addTo(g);
      keyboard(poly.getElement(), cell, allOther ? `${drawn.length} vending machines by other operators` : `${drawn.length} places in this small hexagon`, pick);
      for (const t of real) drawnAt.current.set(thingKey(t), { poly: f?.corners ?? cellCorners(cell) });
    }
    // every single thing stands on its real spot; marks too close for a thumb fan out, with a line back to the spot
    const real = singles.map((t) => map.latLngToLayerPoint([t.lat, t.lon]));
    const spread = fanOut(real.map((p) => ({ x: p.x, y: p.y })));
    singles.forEach((t, i) => {
      const s = spread[i], at = map.layerPointToLatLng(L.point(s.at.x, s.at.y));
      const tone = t.kind === "store" ? ORANGE : t.kind === "machine" ? (t.m.btc ? ORANGE : CYAN) : GREY;
      if (s.size > 1) {
        L.polyline([[t.lat, t.lon], at], { color: tone, weight: 1.6, opacity: 0.95, interactive: false }).addTo(g);
        L.circleMarker([t.lat, t.lon], { radius: 3.5, color: "#141414", weight: 1, fillColor: tone, fillOpacity: 1, interactive: false }).addTo(g);
      }
    });
    singles.forEach((t, i) => {
      const s = spread[i], at = map.layerPointToLatLng(L.point(s.at.x, s.at.y));
      const key = thingKey(t);
      const html = t.kind === "store" ? siteSpotSvg(MARK_PX, operator ? t.pin.score : undefined) : t.kind === "machine" ? (t.m.btc ? coinSvg(MARK_PX) : machineSvg(MARK_PX, CYAN)) : machineSvg(MARK_PX, GREY);
      const fresh1 = t.kind === "store" && fresh.includes(t.pin.id);
      const mk = L.marker(at, { icon: L.divIcon({ className: "rmark" + (fresh1 ? " droppin" : ""), html, iconSize: [MARK_PX, MARK_PX], iconAnchor: [MARK_PX / 2, MARK_PX / 2] }), keyboard: false, riseOnHover: true });
      const pick = () => {
        openerCell.current = key;
        if (t.kind === "store") openItem({ kind: "store", pin: t.pin });
        else if (t.kind === "machine") openItem({ kind: "machine", m: t.m });
        else setCard({ kind: "others", count: 1, lat: t.lat, lon: t.lon });
      };
      mk.on("click", (e) => { L.DomEvent.stopPropagation(e); pick(); }).addTo(g);
      keyboard(mk.getElement(), key, nameOf(t), pick);
      drawnAt.current.set(key, { at: [at.lat, at.lng] });
    });
  }, [ready, mode, view, gridRes, level, things, fresh, markPx, openItem, operator]);
  useEffect(() => {
    const L = LRef.current, g = gridRef.current;
    if (!ready || !L || !g) return;
    g.clearLayers();
    if (!view || mode !== "pins") return;
    if (level === "levels") {
      // the bold borders are the parent cells; seven whole small hexagons sit inside each. The one under the middle of the map is boldest.
      const mid = cellOf((view.n + view.s) / 2, (view.e + view.w) / 2, gridRes - 1);
      for (const p of cellsInView(view, gridRes - 1, 300)) {
        const on = p === mid;
        for (const k of fittedChildren(p, gridRes)) L.polygon(k.corners, { color: "#ffffff", opacity: on ? 0.5 : 0.2, weight: on ? 1.3 : 1, fill: on, fillColor: "#ffffff", fillOpacity: 0.045, interactive: false }).addTo(g);
        L.polygon(cellCorners(p), { color: "#ffffff", opacity: on ? 1 : 0.5, weight: on ? 4 : 2, fill: false, interactive: false }).addTo(g);
      }
      return;
    }
    // all the way in the grid stays, fainter, under marks that stand on their buildings
    const faint = level === "building" ? 0.1 : 0.16;
    for (const c of cellsInView(view, gridRes, 700)) L.polygon(cellCorners(c), { color: "#ffffff", opacity: faint, weight: 1, fill: false, interactive: false }).addTo(g);
  }, [ready, mode, view, gridRes, level]);

  // the open card's thing is ringed in cyan; hover on a list row rings its place in orange. A spot gets a hexagon ring, a cell or small hexagon its outline.
  useEffect(() => {
    const L = LRef.current, ring = ringRef.current;
    if (!ready || !L || !ring) return;
    ring.clearLayers();
    if (mode !== "pins") return;
    // the open card's thing; with no card, the list's selection on a wide screen (the phone shows no list beside the map)
    const selKey = card ? cardThingKey(card) : wide && current ? "s:" + current.id : null;
    const draw = (key: string | null, color: string, fill: boolean) => {
      if (!key) return false;
      const d = drawnAt.current.get(key);
      if (d?.at) {
        const px = MARK_PX + 18;
        L.marker(d.at, { icon: L.divIcon({ className: "rring", html: ringSvg(px, color, fill), iconSize: [px, px], iconAnchor: [px / 2, px / 2] }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(ring);
      } else if (d?.poly) L.polygon(d.poly, { color, weight: fill ? 4 : 3, fillColor: color, fillOpacity: fill ? 0.14 : 0, interactive: false }).addTo(ring);
      else return false;
      return true;
    };
    if (!draw(selKey, "#00ffff", true)) {
      // not drawn yet (outside the view): outline its true cell, as before
      const s = card ? targetAt(card) : wide && current ? byId.get(current.id) : undefined;
      const sc = s ? cellOf(s.lat, s.lon, gridRes) : null;
      if (sc) L.polygon(cellCorners(sc), { color: "#00ffff", weight: 4, fillColor: "#00ffff", fillOpacity: 0.14, interactive: false }).addTo(ring);
    }
    const hk = hover ? "s:" + hover : null;
    if (hk && hk !== selKey) draw(hk, "#f7931a", false);
  }, [ready, mode, current?.id, hover, gridRes, cardKey, wide, view, things, level, operator]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function pickMode(m: "pins" | "areas") { setMode(m); setCard(null); }

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
            <button aria-pressed={mode === "pins"} onClick={() => pickMode("pins")}>Pins</button>
            <button aria-pressed={mode === "areas"} onClick={() => pickMode("areas")}>Areas</button>
          </div>
          <div className="chips">
          <span className="chip"><HexMark kind="coin" size={20} />Placed machines {ours.length}</span>
          <span className="chip"><HexMark kind="site" size={20} />Potential sites {shown.length}</span>
          <button className="chip" aria-pressed={mode === "areas"} onClick={() => pickMode("areas")}>Open jobs {jobs.length}</button>
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
          {card && mode === "pins" && <PinCard ref={cardRef} target={card} operator={operator} mailOn={mailOn} onClose={closeCard} onPick={openItem} />}
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
            <span><HexMark kind="machine" size={20} tone="#00ffff" />Our machine: filled hexagon</span>
            <span><HexMark kind="machine" size={20} tone="#8a9bb0" />Grey hexagon: vending machines by other operators, from OpenStreetMap. A number is how many.</span>
            {/* r26 B6: operators see each site's fit number, as in round 3 picture 2. The public sees no numbers. */}
            {operator && <span className="fitkey"><b style={{ color: "#ffc266" }}>86</b> Fit 80 and up <b>64</b> Fit 60 to 79 <b style={{ color: "#9aa3ad", fontWeight: 600 }}>41</b> Fit under 60. A number in a solid hexagon is a count.</span>}
            <span className="flipnote"><HexMark kind="site" size={22} /><HexMark kind="machine" size={22} tone="#00ffff" /><span><b>Before and after.</b> When the host says yes, the dotted hexagon flips to a filled one. Numbers in a hexagon are groups.</span></span>
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
