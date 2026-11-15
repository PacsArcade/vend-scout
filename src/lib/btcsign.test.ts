import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { BTC_SIGN_PATH, btcMarkHtml, btcSign, coinSvg } from "./hexart";

// r25a: the Bitcoin sign is a drawn path everywhere. No font glyph (U+20BF), no letter B standing in for it.
const GLYPH = /₿|\\u20bf|&#x20bf;|&#8383;/i;
const noTextSign = (svg: string) => {
  expect(svg).not.toMatch(/<text\b/);
  expect(svg).not.toMatch(GLYPH);
  expect(svg).not.toMatch(/>\s*B\s*</); // a bare B as element text
};

describe("the Bitcoin sign", () => {
  it("is one shared path: the B outline, its two holes, two strokes above and two below", () => {
    expect(BTC_SIGN_PATH.match(/M/g)?.length).toBe(7);
    // strokes reach above and below the B (which runs -7 to 7)
    expect(BTC_SIGN_PATH).toContain("-9.6");
    expect(BTC_SIGN_PATH).toContain("9.6");
    expect(btcSign(16, 16, 15)).toContain(BTC_SIGN_PATH);
    expect(btcSign(16, 16, 15)).toContain("rotate(14)");
  });
  it("coinSvg draws the path, not a glyph or a letter", () => {
    for (const s of [16, 24, 32, 64]) {
      const svg = coinSvg(s);
      noTextSign(svg);
      expect(svg).toContain(BTC_SIGN_PATH);
      expect(svg).toContain("rotate(14)");
    }
  });
  it("the map mark draws the path and scales with the cell", () => {
    const small = btcMarkHtml(30), big = btcMarkHtml(120);
    for (const h of [small, big]) { noTextSign(h); expect(h).toContain(BTC_SIGN_PATH); }
    const height = (h: string) => Number(h.match(/height="([\d.]+)"/)?.[1]);
    expect(height(big) / height(small)).toBeCloseTo(4, 1);
  });
  it("ScoutClient puts the drawn mark on a bitcoin machine, never a bare B or a glyph", () => {
    const src = readFileSync(path.join(__dirname, "../components/ScoutClient.tsx"), "utf8");
    const btcLines = src.split("\n").filter((l) => /\.btc\b/.test(l));
    expect(btcLines.some((l) => l.includes("btcMarkHtml(markPx)"))).toBe(true);
    for (const l of btcLines) {
      expect(l).not.toMatch(/["'`]B["'`]/);
      expect(l).not.toMatch(GLYPH);
    }
    expect(src).not.toMatch(/label\([^)]*["'`]B["'`]/);
  });
});
