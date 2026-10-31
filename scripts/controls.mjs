// Lists every button and link on every page and what it does. Exit 1 if any control is not documented.
// Needs the app running (BASE, default http://localhost:4310) and chromium. Best against the seeded state.
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:4310";
const PAGES = ["/jobs", "/run", "/run?crew=a201", "/machines/inventory", "/host/PROSPECT", "/shelf/mine", "/crew", "/crew/apply?role=runner", "/crew/applicants", "/routes", "/run/r203", "/scout", "/prospects", "/prospects/PROSPECT", "/prospects/PROSPECT/site", "/machines", "/machines/new", "/machines/m1", "/shelf", "/shelf/new", "/shelf/l2", "/shelf/l1", "/orders", "/pickup/4219", "/vote/m1", "/pay/m1/A2", "/pay/m1/L1"];

// [matches label or href, what it does]
const DOES = [
  [/^Jobs$/, "main nav link to the open jobs board"],
  [/^Use my location$/, "asks the browser for your position to sort jobs by distance"],
  [/^My claimed jobs$/, "link to the phone page with the jobs you claimed"],
  [/^Claim$/, "claims that job for the chosen crew member (only On the crew can)"],
  [/^Claim the route$/, "assigns the whole route bundle to the chosen crew member"],
  [/^Open jobs$/, "link to the open jobs board"],
  [/^Open the route$/, "opens the route phone view"],
  [/^Mark job done$/, "uploads the photo, marks the claimed job done with its block height"],
  [/^Machine inventory$/, "link to the inventory page"],
  [/^Add to inventory$/, "adds the machine as In storage"],
  [/^Place this machine$|^Place a machine$/, "link to place a machine from inventory"],
  [/^Mark In repair$|^Return to storage$|^Retire it$|^Back to storage$/, "changes the machine status (a placed machine leaves its host)"],
  [/^Tell us what I would like$/, "saves the host's machine choices on the prospect"],
  [/^My listings$|^Find my listings$/, "link to the page that finds listings by Lightning address"],
  [/^Find$/, "looks up listings by the Lightning address typed"],
  [/^\/host\//, "link to the host page for this place"],
  [/^Menu$|^Close menu$/, "phone only: shows or hides the main menu"],
  [/^Apply$/, "opens the application form for that role"],
  [/^Send my application$/, "saves the application on the applicants board"],
  [/^Back to the crew page$/, "link to /crew"],
  [/^Save step$/, "moves the applicant to the chosen step and saves the note (BFT and block stamped)"],
  [/^Use the suggested stops$/, "fills the stop list with machines that have low slots or votes"],
  [/^Up$|^Down$/, "moves the stop one place in the order"],
  [/^Remove$/, "takes the stop off the route"],
  [/^Create route$/, "saves the route with its stops and runner"],
  [/^Open the runner view$/, "opens the phone view for that route"],
  [/^Directions$/, "opens OpenStreetMap directions to the stop (new tab)"],
  [/^Snap a photo$/, "opens the camera or file chooser for proof of the stop"],
  [/^Mark done$/, "uploads the photo, logs the stop with its block height, shows the next stop"],
  [/^Log contact$/, "saves an outreach entry (who, how, outcome, note) with its block stamp"],
  [/^photo$/, "opens the stop's proof photo"],
  [/^Add a photo of the label$/, "opens the file chooser for the label photo"],
  [/^Open the runner view$/, "opens the phone view"],
  [/^Orders$|^Routes$|^Crew$/, "main nav link"],
  [/^Map$/, "phone only: shows the map tab"],
  [/^List \( ?\d+ ?\)$/, "phone only: shows the list tab (what is inside the map view)"],
  [/^Find contacts for the top \d+$/, "reads each top place's own website, one site at a time (robots.txt respected, 3 pages at most, cached)"],
  [/^Find contacts$/, "reads this place's own website (home page plus one contact page) and lists what it publishes"],
  [/^Build them a site$|^Open their site package$/, "opens the one-page site preview for a place with no website"],
  [/^Save as drafted$|^Mark offered$|^Mark accepted$/, "saves the site package status on the prospect"],
  [/^Back to the prospect$/, "link to the prospect page"],
  [/^Scan the machine's label$/, "opens the camera (BarcodeDetector, else zxing) and fills the label code"],
  [/^Stop the camera$/, "closes the camera"],
  [/^Track a new place$/, "link to the map to find and track a place"],
  [/^Place machine$/, "creates the machine at the chosen prospect, moves it to Placed, opens the machine"],
  [/^Place a machine$/, "link to the place-a-machine page"],
  [/^Save profile$/, "saves make, model, serial, label code, payment, telemetry, notes and the label photo"],
  [/^Edit the profile$|^Close the editor$/, "opens the profile editor"],
  [/^their page$|^mailto:|^tel:|^https?:\/\//, "contact link: email, phone or the page it came from"],
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
