import { coinSvg, machineSvg, siteSvg } from "@/lib/hexart";
import { cellCorners, checkInZone, ringOf } from "@/lib/areas";

/** One mark, drawn from the shared strings. kind: coin (placed, takes bitcoin), machine (placed), site (potential). */
export function HexMark({ kind, size = 24, label }: { kind: "coin" | "machine" | "site"; size?: number; label?: string }) {
  const html = kind === "coin" ? coinSvg(size) : kind === "machine" ? machineSvg(size) : siteSvg(size);
  return <span className="hexmark" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} dangerouslySetInnerHTML={{ __html: html }} />;
}

type LL = [number, number];
function project(cells: string[], extra: string[] = []) {
  const all = [...cells, ...extra].map((c) => cellCorners(c));
  const pts = all.flat();
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const sc = 1000 / span;
  const at = (p: LL) => [(p[1] * k - minX) * sc, (-p[0] - minY) * sc] as const;
  return { at, w: (maxX - minX) * sc, h: (maxY - minY) * sc };
}
const d = (cell: string, at: (p: LL) => readonly [number, number]) => cellCorners(cell).map((p, i) => { const [x, y] = at(p); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ") + "Z";

/** The check-in zone of a machine: its own cell and two rings (19 hexagons), dashed cyan, with the machine in the middle. Pure SVG, no map tiles, no network. */
export function HexZone({ lat, lon, coin, className = "" }: { lat?: number; lon?: number; coin: boolean; className?: string }) {
  const z = checkInZone(lat, lon);
  if (!z) return null;
  const wider = [...new Set(z.cells.flatMap((c) => ringOf(c)))].filter((c) => !z.cells.includes(c));
  const { at, w, h } = project(z.cells, wider);
  const [cx, cy] = at((() => { const c = cellCorners(z.center); return [c.reduce((a, p) => a + p[0], 0) / 6, c.reduce((a, p) => a + p[1], 0) / 6] as LL; })());
  const inner = (coin ? coinSvg(32) : machineSvg(32)).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return (
    <svg className={`hexzone ${className}`.trim()} viewBox={`-20 -20 ${(w + 40).toFixed(0)} ${(h + 40).toFixed(0)}`} role="img" aria-label="Check-in zone: the machine's hexagon and two rings of hexagons around it, 19 in all">
      <g fill="#1f1f1f" stroke="#4d5257" strokeWidth="2">{wider.map((c) => <path key={c} d={d(c, at)} />)}</g>
      <g fill="rgba(0,255,255,.10)" stroke="#00ffff" strokeWidth="3" strokeDasharray="9 7">{[...z.ring1, ...z.ring2].map((c) => <path key={c} d={d(c, at)} />)}</g>
      <path d={d(z.center, at)} fill="rgba(0,255,255,.18)" stroke="#00ffff" strokeWidth="5" />
      <g transform={`translate(${(cx - 48).toFixed(1)} ${(cy - 48).toFixed(1)}) scale(3)`} dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}

/** A service area: the named res 7 cells filled cyan among their neighbours. Areas, never a street address. */
export function HexAreas({ cells, className = "" }: { cells: string[]; className?: string }) {
  if (cells.length === 0) return null;
  const wider = [...new Set(cells.flatMap((c) => ringOf(c)))].filter((c) => !cells.includes(c));
  const wider2 = [...new Set(wider.flatMap((c) => ringOf(c)))].filter((c) => !cells.includes(c) && !wider.includes(c));
  const { at, w, h } = project(cells, [...wider, ...wider2]);
  return (
    <svg className={`hexzone ${className}`.trim()} viewBox={`-20 -20 ${(w + 40).toFixed(0)} ${(h + 40).toFixed(0)}`} role="img" aria-label={`Service area: ${cells.length} hexagon${cells.length === 1 ? "" : "s"}`}>
      <g fill="#1f1f1f" stroke="#4d5257" strokeWidth="2">{[...wider, ...wider2].map((c) => <path key={c} d={d(c, at)} />)}</g>
      <g fill="rgba(0,255,255,.16)" stroke="#00ffff" strokeWidth="5">{cells.map((c) => <path key={c} d={d(c, at)} />)}</g>
    </svg>
  );
}

/** A banner of hexagons, coloured from the key, for a profile with no banner of its own. Decoration only. */
export function HexBanner({ seed, className = "" }: { seed: string; className?: string }) {
  const tones = ["#0f4a4d", "#171c26", "#3b2a14", "#2e1d3d", "#0b3a3d", "#1f1f1f"];
  const r = 26, w = Math.sqrt(3) * r, rows = 5, cols = 24;
  const hex = (cx: number, cy: number) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const cells: React.ReactElement[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const n = parseInt(seed.charAt((y * cols + x) % seed.length) || "0", 16) || 0;
    cells.push(<polygon key={`${x}-${y}`} points={hex(x * w + (y % 2 ? w / 2 : 0), y * r * 1.5)} fill={tones[(n + x + y) % tones.length]} stroke="#1b1b1b" strokeWidth="2" />);
  }
  return <svg className={`k0-banner ${className}`.trim()} viewBox={`0 0 ${(cols * w).toFixed(0)} 120`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">{cells}</svg>;
}
