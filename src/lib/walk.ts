// r26 (card 04 A): "Walk there" opens the phone's own maps app at the machine. A plain link: no script, no tracking, no account.
// Apple devices open Apple Maps (maps.apple.com is the address Apple's Maps app answers to). Android answers the geo: link with
// whichever maps app the phone uses. A desktop with neither gets the spot on openstreetmap.org.

export type WalkKind = "apple" | "geo" | "osm";
export function walkKind(ua: string): WalkKind {
  if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) return "apple";
  if (/Android/i.test(ua)) return "geo";
  return "osm";
}
/** The link for "Walk there". Coordinates only, rounded to about 10 cm; on Android the name rides along so the maps app can label the pin. */
export function walkHref(lat: number, lon: number, name: string, ua: string): string {
  const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const kind = walkKind(ua);
  if (kind === "apple") return `https://maps.apple.com/?daddr=${ll}&dirflg=w`;
  if (kind === "geo") return `geo:${ll}?q=${ll}(${encodeURIComponent(name)})`;
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=19/${lat.toFixed(6)}/${lon.toFixed(6)}`;
}
