"use client";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint { id: string; lat: number; lon: number; kind: "applicant" | "machine" | "stop" | "chosen"; label: string }
const STYLE: Record<MapPoint["kind"], Leaflet.CircleMarkerOptions> = {
  applicant: { radius: 8, color: "#d4a843", fillColor: "#d4a843", fillOpacity: 0.9, weight: 2 },
  machine: { radius: 8, color: "#5fd38a", fillColor: "#5fd38a", fillOpacity: 0.9, weight: 2 },
  stop: { radius: 8, color: "#5fd38a", fillColor: "#0a0810", fillOpacity: 1, weight: 3 },
  chosen: { radius: 10, color: "#ffffff", fillColor: "#5fd38a", fillOpacity: 1, weight: 3 },
};

/** A small OpenStreetMap map with dark tiles. Points can be clicked (onPick) or the empty map can be clicked (onPlace). */
export function MiniMap({ points, center, zoom = 11, onPick, onPlace, placed, label }: { points: MapPoint[]; center: [number, number]; zoom?: number; onPick?: (id: string) => void; onPlace?: (lat: number, lon: number) => void; placed?: { lat: number; lon: number } | null; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const cb = useRef({ onPick, onPlace });
  cb.current = { onPick, onPlace };

  useEffect(() => {
    let dead = false;
    (async () => {
      const lf = (await import("leaflet")).default as typeof Leaflet;
      if (dead || !el.current || map.current) return;
      L.current = lf;
      const m = lf.map(el.current, { attributionControl: true }).setView(center, zoom);
      lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
      layer.current = lf.layerGroup().addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => cb.current.onPlace?.(e.latlng.lat, e.latlng.lng));
      map.current = m;
      m.fire("moveend");
      setTimeout(() => m.invalidateSize(), 100);
      draw();
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function draw() {
    const lf = L.current, g = layer.current;
    if (!lf || !g) return;
    g.clearLayers();
    for (const p of points) lf.circleMarker([p.lat, p.lon], STYLE[p.kind]).bindTooltip(p.label).on("click", (e) => { lf.DomEvent.stopPropagation(e); cb.current.onPick?.(p.id); }).addTo(g);
    if (placed) lf.circleMarker([placed.lat, placed.lon], { radius: 10, color: "#fff", fillColor: "#ff6400", fillOpacity: 0.8, weight: 3 }).addTo(g);
  }
  useEffect(draw, [points, placed]);

  return <div ref={el} className="minimap" role="application" aria-label={label} />;
}
