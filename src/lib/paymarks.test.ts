import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PayMarks } from "@/components/PayMarks";
import { BTC_SIGN_PATH } from "./hexart";
import { CARD_FACT_BG, contrast, MARK_INK, takesSaid, type PayWay } from "./machinecard";

// r26 A3: the machine card's "Takes" fact shows the marks for the money. Bitcoin is the drawn sign, cash is "$".
const html = (ways: PayWay[]) => renderToStaticMarkup(createElement(PayMarks, { ways }));
const visible = (h: string) => h.match(/<span class="pm" aria-hidden="true">([\s\S]*)<\/span><\/span>$/)?.[1] ?? "";

describe("the money marks on the machine card", () => {
  it("a screen reader hears one line: Takes bitcoin and cash", () => {
    expect(takesSaid(["bitcoin", "cash"])).toBe("Takes bitcoin and cash");
    expect(takesSaid(["bitcoin"])).toBe("Takes bitcoin");
    expect(takesSaid(["cash"])).toBe("Takes cash");
    expect(takesSaid(["bitcoin", "cards", "cash"])).toBe("Takes bitcoin, cards and cash");
    expect(takesSaid([])).toBeNull();
    const h = html(["bitcoin", "cash"]);
    expect(h).toContain('<span class="sr">Takes bitcoin and cash</span>');
    expect(h).toContain('aria-hidden="true"'); // the marks themselves are not read
  });
  it("bitcoin is the drawn path: no letter B, no font glyph, no words", () => {
    const v = visible(html(["bitcoin", "cash"]));
    expect(v).toContain(BTC_SIGN_PATH);
    expect(v).toContain("rotate(14)");
    expect(v).not.toMatch(/<text\b/);
    expect(v).not.toMatch(/₿|&#x20bf;|&#8383;/i);
    expect(v).not.toMatch(/>\s*B\s*</);
    expect(v).not.toMatch(/bitcoin or cash|Bitcoin/);
    expect(v).toMatch(/>\$<\/b>/);
  });
  it("shows only the marks the machine takes", () => {
    const btc = visible(html(["bitcoin"])), cash = visible(html(["cash"]));
    expect(btc).toContain('data-way="bitcoin"'); expect(btc).not.toContain('data-way="cash"');
    expect(cash).toContain('data-way="cash"'); expect(cash).not.toContain('data-way="bitcoin"');
    expect(html([])).toContain("No way to pay is recorded yet.");
  });
  it("every mark is 4.5:1 or more against the card (measured, WCAG 2)", () => {
    for (const ink of Object.values(MARK_INK)) expect(contrast(ink, CARD_FACT_BG)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5); // the formula itself
    // the card's fact boxes really are that colour
    const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
    expect(css).toContain(`.pincard .facts div{background:${CARD_FACT_BG}`);
  });
  it("the map's machine card uses the marks, not the words", () => {
    const src = readFileSync(path.join(__dirname, "../components/PinCard.tsx"), "utf8");
    expect(src).toContain("<PayMarks ways={m.ways} />");
    expect(src).not.toContain("<PayLine");
  });
});
