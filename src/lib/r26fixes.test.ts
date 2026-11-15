import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { unhosted } from "./hexlevels";
import { fitInk } from "./hexart";
import { contrast } from "./machinecard";

// r26 send-back (Lumen, block 975,997): four fixes before the forge.
const read = (rel: string) => readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("fix 1: one place, one mark", () => {
  const stores = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
  it("a store with a placed machine draws no mark of its own", () => {
    expect(unhosted(stores, [{ prospectId: "s2" }]).map((s) => s.id)).toEqual(["s1", "s3"]);
  });
  it("machines with no host, or an empty host, hide nothing", () => {
    expect(unhosted(stores, [{}, { prospectId: "" }])).toEqual(stores);
    expect(unhosted(stores, [])).toEqual(stores);
  });
  it("the map builds its stores through it, and the page passes the host on", () => {
    expect(read("components/ScoutClient.tsx")).toContain("...unhosted(shown, ours).map(");
    expect(read("app/scout/page.tsx")).toContain("prospectId: m.prospectId || undefined");
  });
});

describe("fix 2: the machine card's four buttons are even", () => {
  const src = read("components/PinCard.tsx"), css = read("app/globals.css");
  it("one grid: Walk there full width, two equal halves, the vote full width", () => {
    const acts = src.slice(src.indexOf('<div className="acts mach">'), src.indexOf("</div>", src.indexOf('<div className="acts mach">')));
    const order = ["Walk there</a>", "Report a problem</button>", "Machine page</Link>", "Vote on what goes in</Link>"].map((t) => acts.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(acts).toMatch(/className="btn gild wide"[^>]*>|className="btn gild wide"/);
    expect(acts).toContain('className="btn wide" href={`/vote/');
    expect(css).toContain(".pincard .acts.mach{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}");
    expect(css).toContain(".pincard .acts.mach .wide{grid-column:1/-1}");
  });
});

describe("fix 3: the fit key", () => {
  it("three items, each the mark then its words, and the count line on its own", () => {
    const src = read("components/ScoutClient.tsx");
    expect(src).toMatch(/FIT_KEY = \[\{ score: 86, words: "Fit 80 and up" \}, \{ score: 64, words: "Fit 60 to 79" \}, \{ score: 41, words: "Fit under 60" \}\]/);
    expect(src).toContain('className="fitcount">A number in a solid hexagon is a count.');
    expect(read("app/globals.css")).toMatch(/\.legend \.fitkey \.fk\{[^}]*white-space:nowrap/);
  });
  it("each fit colour is 4.5:1 or more on the legend and inside the hexagon", () => {
    // the legend sits on #1b1b1b; the dotted hexagon fills #1b1b1b at .82 over it, which is the same colour
    for (const s of [86, 64, 41]) expect(contrast(fitInk(s).ink, "#1b1b1b")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("fix 4: the same money marks on the machine page and the list", () => {
  it("the /m/ page and the machines list use PayMarks, not words", () => {
    const m = read("app/m/[machine]/page.tsx"), list = read("app/machines/page.tsx");
    expect(m).toContain("<PayMarks ways={payWays(m.profile)} />");
    expect(m).not.toContain("<PayLine");
    expect(list).toContain("<PayMarks ways={payWays(m.profile)} />");
    expect(list).not.toContain("<BitcoinMark");
  });
});
