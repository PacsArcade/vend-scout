import { describe, expect, it } from "vitest";
import { cellToChildren, cellToParent, getHexagonEdgeLengthAvg } from "h3-js";
import { readFileSync } from "fs";
import path from "path";
import { cellCorners, cellOf } from "./areas";
import { isPointInPolygon } from "./hexcells.testutil";
import { GRID_FINEST, resForPixels } from "./hexcells";
import { FAN_GAP, fanOut, fittedChildren, FIT_R, levelFor, MARK_PX } from "./hexlevels";
import { walkHref, walkKind } from "./walk";

// r26, hexagon round 3 (card 04 A: go; card 02 A: seven whole hexagons fitted inside the bold border).
const CHI = [41.9189, -87.66] as const;

describe("which view the map shows", () => {
  it("all the way in is the building view, one grid level out is the levels view, further out is unchanged", () => {
    expect(levelFor(GRID_FINEST)).toBe("building");
    expect(levelFor(GRID_FINEST - 1)).toBe("levels");
    expect(levelFor(GRID_FINEST - 2)).toBe("cells");
    expect(levelFor(5)).toBe("cells");
    // Chicago, zoom 19 and zoom 15 (0.22 and 3.56 metres per pixel)
    expect(levelFor(resForPixels(0.22))).toBe("building");
    expect(levelFor(resForPixels(3.56))).toBe("levels");
  });
});

describe("seven whole small hexagons inside the bold border", () => {
  for (const res of [8, 9]) {
    const parent = cellOf(CHI[0], CHI[1], res)!;
    const kids = fittedChildren(parent);
    it(`res ${res}: seven, one per true child, every corner inside the border`, () => {
      expect(kids).toHaveLength(7);
      expect(new Set(kids.map((k) => k.cell))).toEqual(new Set(cellToChildren(parent, res + 1)));
      expect(kids.map((k) => k.slot)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      const border = cellCorners(parent);
      for (const k of kids) {
        expect(k.corners).toHaveLength(6);
        for (const c of k.corners) expect(isPointInPolygon(c, border), `${k.slot}`).toBe(true);
        expect(cellToParent(k.cell, res)).toBe(parent);
      }
    });
    it(`res ${res}: each is a little smaller than the true child, and each sits on the side of its true child`, () => {
      const m = (a: readonly number[], b: readonly number[]) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * Math.cos((CHI[0] * Math.PI) / 180));
      const trueR = getHexagonEdgeLengthAvg(res + 1, "m");
      for (const k of kids) {
        const r = m(k.centre, k.corners[0]);
        expect(r).toBeLessThan(trueR);
        expect(r).toBeGreaterThan(trueR * 0.75); // FIT_R x sqrt(7) = 0.86 of the true size
        // the small hexagon's middle is nearer its own true child's middle than any other child's
        const own = cellCorners(k.cell).reduce((a, p) => [a[0] + p[0] / 6, a[1] + p[1] / 6], [0, 0]);
        for (const o of kids) if (o.cell !== k.cell) {
          const other = cellCorners(o.cell).reduce((a, p) => [a[0] + p[0] / 6, a[1] + p[1] / 6], [0, 0]);
          expect(m(k.centre, own)).toBeLessThan(m(k.centre, other));
        }
      }
    });
  }
  it("uses card 02's size", () => expect(FIT_R).toBe(0.325));
});

describe("marks too close for a thumb fan out", () => {
  it("leaves marks that are far enough apart on their real spot", () => {
    const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 200 }];
    const out = fanOut(pts);
    out.forEach((o, i) => { expect(o.at).toEqual(pts[i]); expect(o.size).toBe(1); });
  });
  it("spreads a close group so no two marks are closer than a thumb", () => {
    for (const n of [2, 3, 5, 8]) {
      const pts = Array.from({ length: n }, (_, i) => ({ x: 100 + i * 3, y: 100 + (i % 2) * 4 }));
      const out = fanOut(pts);
      for (const o of out) expect(o.size).toBe(n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(Math.hypot(out[i].at.x - out[j].at.x, out[i].at.y - out[j].at.y)).toBeGreaterThanOrEqual(FAN_GAP - 1e-6);
    }
    expect(FAN_GAP).toBeGreaterThan(MARK_PX); // a 44 px tap target, with air between
  });
  it("the map draws the spider line back to the real spot", () => {
    const src = readFileSync(path.join(__dirname, "../components/ScoutClient.tsx"), "utf8");
    expect(src).toMatch(/L\.polyline\(\[\[t\.lat, t\.lon\], at\]/);
    expect(src).toContain("fanOut(");
  });
});

describe("Walk there", () => {
  const AND = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
  const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
  const LIN = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36";
  it("opens the phone's own maps app with the spot, and nothing else", () => {
    expect(walkKind(AND)).toBe("geo");
    expect(walkHref(41.9174994, -87.6597023, "TEST Machine 01", AND)).toBe("geo:41.917499,-87.659702?q=41.917499,-87.659702(TEST%20Machine%2001)");
    expect(walkKind(IOS)).toBe("apple");
    expect(walkHref(41.9174994, -87.6597023, "x", IOS)).toBe("https://maps.apple.com/?daddr=41.917499,-87.659702&dirflg=w");
    expect(walkHref(41.9174994, -87.6597023, "x", LIN)).toBe("https://www.openstreetmap.org/?mlat=41.917499&mlon=-87.659702#map=19/41.917499/-87.659702");
  });
  it("carries no tracking: no utm, no ids, no google", () => {
    for (const ua of [AND, IOS, LIN]) expect(walkHref(1, 2, "n", ua)).not.toMatch(/utm_|google|fbclid|gclid|ref=/i);
  });
});

describe("Where inside", () => {
  it("the operator form asks for it, the store keeps it, and the card hides the line when it is empty", () => {
    const form = readFileSync(path.join(__dirname, "../components/MachineForm.tsx"), "utf8");
    expect(form).toContain('set("whereInside"');
    const store = readFileSync(path.join(__dirname, "store.ts"), "utf8");
    expect(store).toContain("whereInside: str(p.whereInside, 80)");
    const card = readFileSync(path.join(__dirname, "../components/PinCard.tsx"), "utf8");
    expect(card).toMatch(/\{m\.where && <div className="where"><span>Where inside<\/span>/);
  });
});
