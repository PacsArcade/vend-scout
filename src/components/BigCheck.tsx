/**
 * The big pixel check shown when a crew key signs the code. Eight-bit look: a square frame and a check built from pixels that appear in turn.
 * With reduced motion the whole check is just there. The words under it carry the meaning, so it does not rely on colour.
 */
const EDGE = [[2, 0, 12, 1], [2, 15, 12, 1], [0, 2, 1, 12], [15, 2, 1, 12], [1, 1, 1, 1], [14, 1, 1, 1], [1, 14, 1, 1], [14, 14, 1, 1]];
const TICK: [number, number][] = [[4, 8], [4, 9], [5, 9], [5, 10], [6, 10], [6, 11], [7, 9], [7, 10], [8, 8], [8, 9], [9, 7], [9, 8], [10, 6], [10, 7], [11, 5], [11, 6]];

export function BigCheck({ word = "Signed and verified" }: { word?: string }) {
  return (
    <div className="checkwrap" data-bigcheck>
      <svg className="bigcheck bigcheck-pop" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        <rect className="frame" x="1" y="1" width="14" height="14" />
        {EDGE.map(([x, y, w, h], i) => <rect key={`e${i}`} className="edge" x={x} y={y} width={w} height={h} style={{ ["--i" as string]: i }} />)}
        {TICK.map(([x, y], i) => <rect key={`t${i}`} className="px" x={x} y={y} width="1" height="1" style={{ ["--i" as string]: i }} />)}
      </svg>
      <div className="checkword">{word}</div>
    </div>
  );
}
