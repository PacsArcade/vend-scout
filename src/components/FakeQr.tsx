// A deterministic PLACEHOLDER pattern. It is not a scannable QR code.
export function FakeQr({ seed, size = 170 }: { seed: string; size?: number }) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const n = 21;
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    h = Math.imul(h ^ (x * 31 + y), 16777619) >>> 0;
    if ((h >>> 7) % 3 === 0) cells.push([x, y]);
  }
  const f = (x: number, y: number) => (
    <g key={`f${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#0a0810" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#f6f1e7" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#0a0810" />
    </g>
  );
  return (
    <svg viewBox="0 0 21 21" width={size} height={size} role="img" aria-label="Placeholder QR, not scannable" style={{ margin: "12px auto", display: "block", background: "#f6f1e7", padding: 8, borderRadius: 10 }} shapeRendering="crispEdges">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0810" />)}
      {f(0, 0)}{f(14, 0)}{f(0, 14)}
    </svg>
  );
}
