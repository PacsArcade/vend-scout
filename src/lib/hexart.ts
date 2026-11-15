// The hexagon marks, drawn from the round 2 mockups. Pure strings, so the Leaflet map (HTML icons) and the React pages share one drawing.
// A potential site is a DOTTED hexagon. A machine is a FILLED hexagon. A machine that takes bitcoin (profile.lightning) is a hexagon COIN with the Bitcoin sign (BTC_SIGN_PATH).
const HEX = "M28.6 23.2 L16.0 30.5 L3.4 23.2 L3.4 8.7 L16.0 1.5 L28.6 8.7Z";
const HEX_IN = "M27.8 22.8 L16.0 29.6 L4.2 22.8 L4.2 9.2 L16.0 2.4 L27.8 9.2Z";
export const BTC_ORANGE = "#f7931a";
/**
 * The Bitcoin sign, drawn once as a path. No font glyph: a phone without the right font would pick its own sign, or none.
 * A bold B (stem, two bowls) with two short strokes above and two below. Centred on 0,0, 19.2 units tall with the strokes.
 * Filled nonzero: the outline runs clockwise, the two holes run the other way, the four strokes overlap the B so they join it.
 */
export const BTC_SIGN_PATH =
  "M-5 -7H1.5C4.2 -7 5.2 -5.6 5.2 -3.7C5.2 -2.2 4.4 -1.2 3.2 -0.6C4.8 -0.1 5.8 1.1 5.8 3C5.8 5.5 4.3 7 1.6 7H-5Z" +
  "M-1.8 -4.4V-1.8H1C1.9 -1.8 2.3 -2.3 2.3 -3.1C2.3 -3.9 1.9 -4.4 1 -4.4Z" +
  "M-1.8 0.8V4.4H1.3C2.4 4.4 2.9 3.5 2.9 2.6C2.9 1.5 2.4 0.8 1.3 0.8Z" +
  "M-3.4 -9.6H-1.8V-6.5H-3.4ZM0.2 -9.6H1.8V-6.5H0.2Z" +
  "M-3.4 6.5H-1.8V9.6H-3.4ZM0.2 6.5H1.8V9.6H0.2Z";
/** The lean, the same 14 degrees the coin has always had. */
export const BTC_SIGN_LEAN = 14;
/** The sign as an SVG element string, leaning right, centred at cx,cy and `height` units tall (strokes included). */
export function btcSign(cx: number, cy: number, height: number, ink = "#111"): string {
  const k = +(height / 19.2).toFixed(4);
  return `<path d="${BTC_SIGN_PATH}" fill="${ink}" transform="translate(${cx} ${cy}) rotate(${BTC_SIGN_LEAN}) scale(${k})"/>`;
}
/** Share of the hexagon's height (corner to corner) the sign fills, the same on the coin and on the map. */
export const BTC_SIGN_SHARE = 0.53;
/** The map mark: the sign alone, sized from the drawn hexagon (markPx, corner to corner), centred on the Leaflet anchor. */
export function btcMarkHtml(markPx: number, ink = "#111"): string {
  // the box is 16 x 22 units around a 19.2-unit sign, so the leaning sign fits inside it
  const px = Math.max(1, markPx * BTC_SIGN_SHARE) / 19.2, w = 16 * px, h = 22 * px;
  return `<svg width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="-8 -11 16 22" overflow="visible" aria-hidden="true" focusable="false" style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:none">${btcSign(0, 0, 19.2, ink)}</svg>`;
}
const open = (size: number) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">`;

/** A hexagon coin: a placed machine that takes bitcoin. */
export function coinSvg(size = 24): string {
  return `${open(size)}<path d="${HEX}" fill="${BTC_ORANGE}" stroke="#111" stroke-width="1.6"/>${btcSign(16, 16, 29 * BTC_SIGN_SHARE)}</svg>`;
}
/** A filled hexagon with no mark: a placed machine that does not take bitcoin. */
export function machineSvg(size = 24, tone = "#b8c0c8"): string {
  return `${open(size)}<path d="${HEX}" fill="${tone}" stroke="#111" stroke-width="1.6"/></svg>`;
}
/** A dotted hexagon: a potential site. */
export function siteSvg(size = 24, color = BTC_ORANGE): string {
  return `${open(size)}<path d="${HEX_IN}" fill="none" stroke="${color}" stroke-width="2.6" stroke-dasharray="1.6 4.9" stroke-linecap="round"/></svg>`;
}
/** A hexagon with a count inside, for a group of sites. */
export function groupSvg(size: number, n: number, edge = BTC_ORANGE): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="${HEX}" fill="#262626" stroke="${edge}" stroke-width="2.4"/><text x="16" y="20.5" text-anchor="middle" font-family="Noto Sans,DejaVu Sans,sans-serif" font-size="12" font-weight="800" fill="#fff">${n}</text></svg>`;
}
export const hexPath = HEX;

// ---- r26: marks that stand on their real spot (hexagon round 3) ----
/** The fit number's colour, from round 3 picture 2: 80 and up amber, 60 to 79 white, under 60 grey. Operators only. */
export function fitInk(score: number): { ink: string; weight: number } {
  return score >= 80 ? { ink: "#ffc266", weight: 800 } : score >= 60 ? { ink: "#ffffff", weight: 600 } : { ink: "#9aa3ad", weight: 600 };
}
/** A potential site on its real spot: the dotted hexagon over a dark fill, so the map does not show through. With a score (operators), the fit number sits inside. */
export function siteSpotSvg(size = 44, score?: number): string {
  const hot = score !== undefined && score >= 80;
  const num = score === undefined ? "" : (() => { const f = fitInk(score); return `<text x="16" y="20.3" text-anchor="middle" font-family="Noto Sans,DejaVu Sans,sans-serif" font-size="11.5" font-weight="${f.weight}" fill="${f.ink}">${Math.round(score)}</text>`; })();
  return `${open(size)}<path d="${HEX}" fill="#1b1b1b" fill-opacity=".82"/><path d="${HEX_IN}" fill="none" stroke="${BTC_ORANGE}" stroke-width="${hot ? 3.1 : 2.6}" stroke-dasharray="1.6 4.9" stroke-linecap="round"/>${num}</svg>`;
}
/** The selection ring around a mark on its spot: a bigger hexagon outline. */
export function ringSvg(size: number, color = "#00ffff", fill = true): string {
  return `${open(size)}<path d="${HEX}" fill="${fill ? color : "none"}" fill-opacity=".12" stroke="${color}" stroke-width="2"/></svg>`;
}
