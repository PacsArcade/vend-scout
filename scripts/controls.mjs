// Lists every button and link on every page and what it does. Exit 1 if any control is not documented.
// Needs the app running (BASE, default http://localhost:4310) and chromium. Best against the seeded state.
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:4310";
const PAGES = ["/scout", "/prospects", "/prospects/PROSPECT", "/machines", "/machines/new", "/machines/m1", "/shelf", "/shelf/new", "/shelf/l2", "/shelf/l1", "/orders", "/pickup/4219", "/vote/m1", "/pay/m1/A2", "/pay/m1/L1"];

// [matches label or href, what it does]
const DOES = [
  [/^frens\.earth · Machines/, "link to /scout"],
  [/^(Scout|Prospects|Machines|Local shelf|Orders)$/, "main nav link to that section"],
  [/^(Laundromats|Gyms|Car washes|Auto shops|Open late)$/, "toggles that filter on the map and list"],
  [/^Search$/, "looks the place up (Nominatim, cached) and opens /scout for it"],
  [/^Open prospect$/, "opens the selected prospect page"],
  [/^Scan this place$/, "asks OpenStreetMap (Overpass) for each category, once a day per category, then reloads"],
  [/^\d+ \S/, "map list row: selects that place on the map"],
  [/ votes$/, "vote option: picks it, shown highlighted, before pressing Vote"],
  [/^Print pitch sheet$/, "opens the print dialog (print stylesheet shows only the sheet)"],
  [/^Track this place$/, "saves the place at stage Found"],
  [/^Mark as /, "moves the stage track one step and saves"],
  [/^(Add a note|Close note)$/, "shows or hides the note form"],
  [/^Save note$/, "saves the note on this prospect"],
  [/^Place a machine here$/, "opens /machines/new for this prospect"],
  [/^Go to the map$/, "link to /scout"],
  [/^Add a machine$/, "link to /machines/new, or on that page the submit that creates the machine"],
  [/^Add machine$/, "creates the machine and opens it"],
  [/^Approve$/, "host approves the listing; it joins the machine as a local-shelf slot"],
  [/^Decline$/, "host declines the listing"],
  [/^Mark these restocked$/, "sets every low slot back to full"],
  [/^Add slot$/, "adds a slot to the machine"],
  [/^See the votes$/, "link to the phone vote page"],
  [/^List a local item$|^List an item$/, "link to the maker form"],
  [/^Add a pickup order$/, "link to /orders"],
  [/^Send for host approval$/, "saves the listing as pending"],
  [/^See it in the machine$/, "link to the machine page"],
  [/^Open the frens\.earth shop$|^Back to the shop$/, "opens https://frens.earth/store in a new tab"],
  [/^Create pickup code$/, "creates the order, reserves a pickup slot, opens the phone page"],
  [/^Suggest it$/, "adds the suggestion as a new vote option"],
  [/^Vote for /, "counts the vote (double when backed with sats, test mode)"],
  [/^Simulate a payment \(test\)$/, "records a test sale, takes one unit from the slot"],
  [/^Back to the machine$/, "link to the machine page"],
  [/^Held for an order|^[A-Z]\d+\b/, "slot tile: opens that slot's bitcoin page"],
  [/^\/prospects\/|^\/shelf\/|^\/machines\/|^\/pickup\/|^\/orders|^\/scout/, "table link to that record"],
  [/openstreetmap\.org\/copyright|^OpenStreetMap$|^Leaflet$/, "map attribution link (required by OpenStreetMap)"],
  [/^\d{4}$/, "pickup code link to the phone page"],
];
const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ").trim();
let bad = 0;
let prospect = process.env.PROSPECT;
if (!prospect) { const h = await (await fetch(BASE + "/scout")).text(); prospect = (h.match(/osm-[nwr]\d+/) || [])[0]; }
for (const page of PAGES) {
  const url = BASE + page.replace("PROSPECT", prospect ?? "none");
  let dom;
  try { dom = execFileSync("chromium", ["--headless=new", "--virtual-time-budget=5000", "--dump-dom", url], { timeout: 60000, maxBuffer: 50e6 }).toString(); } catch (e) { console.log(page, "FAILED to load"); bad++; continue; }
  const items = [];
  for (const m of dom.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (/leaflet|aria-label="(Zoom|Leaflet)/i.test(m[2])) continue;
    const href = (m[2].match(/href="([^"]*)"/) || [])[1];
    const label = strip(m[3]) || href || "(no label)";
    items.push({ kind: m[1] === "a" ? "link" : "button", label, href });
  }
  console.log(`\n${page}`);
  for (const it of items) {
    const key = it.kind === "link" && it.label.startsWith("http") ? it.href : it.label;
    const hit = DOES.find(([re]) => re.test(key) || (it.href && re.test(it.href)));
    if (!hit) bad++;
    console.log(`  ${it.kind.padEnd(6)} ${it.label.slice(0, 48).padEnd(48)} ${it.href ?? ""}  =>  ${hit ? hit[1] : "UNDOCUMENTED"}`);
    if (it.kind === "link" && (it.href === "#" || !it.href)) { bad++; console.log("    ^ dead link"); }
  }
}
console.log(bad ? `\n${bad} problem(s)` : "\nevery control is documented");
process.exit(bad ? 1 : 0);
