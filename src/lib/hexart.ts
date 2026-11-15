// The hexagon marks, drawn from the round 2 mockups. Pure strings, so the Leaflet map (HTML icons) and the React pages share one drawing.
// A potential site is a DOTTED hexagon. A machine is a FILLED hexagon. A machine that takes bitcoin (profile.lightning) is a hexagon COIN with the B mark.
const HEX = "M28.6 23.2 L16.0 30.5 L3.4 23.2 L3.4 8.7 L16.0 1.5 L28.6 8.7Z";
const HEX_IN = "M27.8 22.8 L16.0 29.6 L4.2 22.8 L4.2 9.2 L16.0 2.4 L27.8 9.2Z";
export const BTC_ORANGE = "#f7931a";
const open = (size: number) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">`;

/** A hexagon coin: a placed machine that takes bitcoin. */
export function coinSvg(size = 24): string {
  return `${open(size)}<path d="${HEX}" fill="${BTC_ORANGE}" stroke="#111" stroke-width="1.6"/><g transform="rotate(14 16 16)"><text x="16" y="21.8" text-anchor="middle" font-family="Noto Sans,DejaVu Sans,sans-serif" font-size="16" font-weight="800" fill="#111">₿</text></g></svg>`;
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
