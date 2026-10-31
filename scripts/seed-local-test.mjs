if (process.env.VERCEL === "1") { console.error("Refusing to write test data on Vercel."); process.exit(1); }
// LOCAL TESTING ONLY. Off by default: nothing runs this unless you do.
// Writes a state file full of obviously fake TEST data. Never point production at it.
//   node scripts/seed-local-test.mjs [out-file]      default: data/state.seed.json
//   VEND_STATE_FILE=data/state.seed.json npm run dev
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname } from "node:path";

// Tiny solid-colour PNGs for the proof photos (TEST pictures, written under data/stops, which is git-ignored).
function png(r, g, b, w = 64, h = 64) {
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of buf) x = t[(x ^ v) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const f = 0.6 + 0.4 * (x / w); raw[o] = r * f; raw[o + 1] = g * f; raw[o + 2] = b * f; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
mkdirSync("data/stops", { recursive: true });
mkdirSync("data/items", { recursive: true });
for (const [n, c] of [["i0-2000001", [220, 120, 60]], ["i0-2000002", [80, 160, 220]], ["i0-2000003", [200, 200, 80]]]) writeFileSync(`data/items/${n}.png`, png(...c));
for (const [n, c] of [["r0-1000001", [90, 140, 200]], ["r0-1000002", [120, 200, 160]], ["r0-1000003", [200, 150, 90]], ["r0-1000004", [160, 110, 200]]]) writeFileSync(`data/stops/${n}.png`, png(...c));

const out = process.argv[2] || "data/state.seed.json";
const now = new Date().toISOString();
const PROSPECT = process.env.SEED_PROSPECT || "osm-n9055118992"; // any id from a scanned place
const slot = (code, name, kind, level, priceSats) => ({ code, name, kind, level, priceSats, report: code === "A1" || code === "A2" ? "sensor" : "hand" });
const state = {
  tracked: { [PROSPECT]: "Placed" },
  notes: {},
  machines: [{
    id: "m1", name: "TEST Machine 01", status: "Placed", type: "combo", prospectId: PROSPECT, hostName: "Su Nueva Lavanderia", lat: 41.8201, lon: -87.6853, hostSharePct: 10, placedAt: now.slice(0, 10),
    profile: { make: "TEST Make", model: "TEST Model 7", serial: "TEST-0001", rawCode: "TEST-0001", cardReader: "", cash: true, lightning: false, telemetry: "sensors", notes: "Seed data for local testing." },
    slots: [
      slot("A1", "Test chips", "snack", 0.1, 3000), slot("A2", "Test crackers", "snack", 0.6, 3000), slot("A3", "Test water", "snack", 0.8, 2000),
      slot("A4", "Test trail mix", "snack", 0.3, 4000), slot("A5", "Test gummies", "snack", 0.9, 3000), slot("A6", "Test cookies", "snack", 0.4, 3500),
      slot("B1", "Arcade sticker pack", "merch", 0.6, 5000), slot("B2", "Arcade mini print", "merch", 0.3, 21000),
      slot("P1", "Arcade mini print", "pickup", 1, 0),
    ],
  }],
  items: [
    { id: "i401", name: "TEST hot chips, 2 oz bag", size: "standard", priceSats: 3000, photo: "i0-2000001.png" },
    { id: "i402", name: "TEST water, 16 oz", size: "large", priceSats: 2000, photo: "i0-2000002.png" },
    { id: "i403", name: "TEST trail mix, small", size: "small", priceSats: 4000, photo: "i0-2000003.png" },
  ],
  aiLog: [],
  proofs: [
    { id: "p300", kind: "job", ref: "restock:m211", by: "a201", machine: "m211", jobKind: "restock", before: "r0-1000001.png", after: "r0-1000002.png", ticked: ["A1"], loadTotal: 1, loadItems: [{ slot: "A1", item: "TEST hot chips, 2 oz bag", ref: "i0-2000001.png" }], soldOutAtVisit: false, status: "sent", history: [{ status: "sent", at: now }], sentAt: now },
    { id: "p301", kind: "job", ref: "restock:m212", by: "a201", machine: "m212", jobKind: "restock", before: "r0-1000003.png", after: "r0-1000004.png", ticked: [], loadTotal: 1, loadItems: [{ slot: "A1", item: "TEST hot chips, 2 oz bag", ref: "i0-2000001.png" }], soldOutAtVisit: false, status: "retake", reason: "The glass photo is blurry. Please retake it in daylight.", history: [{ status: "sent", at: now }, { status: "retake", at: now, note: "blurry" }], sentAt: now },
    { id: "p302", kind: "job", ref: "shelf:l1", by: "a201", machine: "m1", jobKind: "shelf", before: "r0-1000001.png", after: "r0-1000002.png", ticked: [], loadTotal: 0, soldOutAtVisit: false, status: "approved", history: [{ status: "sent", at: now }, { status: "approved", at: now }], sentAt: now, approvedAt: now, points: 700, breakdown: [{ label: "Stop done", points: 100 }, { label: "Clean glass", points: 150 }, { label: "Stocked before sell-out", points: 200 }, { label: "Local shelf delivered", points: 250 }], paidSats: 8750 },
    { id: "p303", kind: "job", ref: "restock:old", by: "a203", jobKind: "restock", before: "r0-1000001.png", after: "r0-1000002.png", ticked: [], loadTotal: 0, soldOutAtVisit: false, status: "approved", history: [{ status: "approved", at: now }], sentAt: now, approvedAt: now, points: 900, breakdown: [{ label: "Stop done", points: 100 }], paidSats: 7000, popSeen: true },
  ],
  claims: [{ job: "restock:m211", kind: "restock", title: "Restock TEST Machine 03", sats: 8000, by: "a201", at: now, h: 973996 }, { job: "restock:m212", kind: "restock", title: "Restock TEST Machine 04", sats: 8000, by: "a201", at: now, h: 973996 }, { job: "shelf:l1", kind: "shelf", title: "Shelf pickup: TEST wildflower honey, 8 oz", sats: 8750, by: "a201", at: now, h: 973990, doneAt: now, doneH: 973995, paidSats: 8750 }, { job: "restock:m1", kind: "restock", title: "Restock TEST Machine 01", sats: 7000, by: "a201", at: now, h: 973996 }],
  hostPicks: {},
  online: { a201: true },
  passes: {},
  seen: {},
  blocks: [],
  payouts: [{ by: "a201", sats: 7000, reason: "Restock TEST Machine 00", at: now, h: 973990, sent: false }, { by: "a201", sats: 8000, reason: "Restock TEST Machine 0Z (busy bonus)", at: now, h: 973991, sent: false }],
  sales: [{ machine: "m1", slot: "A2", item: "Test crackers", sats: 3000, at: now, test: true }, { machine: "m1", slot: "B1", item: "Arcade sticker pack", sats: 5000, at: now, test: true }],
  orders: [{ code: "4219", item: "Arcade mini print", priceSats: 21000, machine: "m1", slot: "P1", createdAt: now, source: "frens.earth (test)" }],
  listings: [
    { id: "l1", n: 1, item: "TEST wildflower honey, 8 oz", kind: "honey", priceSats: 12000, qty: 6, machine: "m1", pickupWindow: "Sat 9 AM to noon", madeBy: "TEST Maker, a backyard hive", lightning: "testmaker@example.invalid", status: "approved", createdAt: now.slice(0, 10) },
    { id: "l2", n: 2, item: "TEST farm eggs, dozen", kind: "eggs", priceSats: 9000, qty: 8, machine: "m1", pickupWindow: "Weekdays after 5 PM", madeBy: "TEST Farm, six hens", lightning: "testfarm@example.invalid", status: "pending", createdAt: now.slice(0, 10) },
  ],
  outreach: { [PROSPECT]: [{ who: "TEST Owner", how: "visit", outcome: "Talked", note: "Left the pitch sheet.", date: now.slice(0, 10), h: 973990 }] },
  applicants: [
    { id: "a201", name: "TEST Runner One", reach: "test1@example.invalid", area: "Pilsen", lat: 41.857, lon: -87.66, roles: ["runner"], transport: ["bike"], hours: "Early mornings", why: "I like being outside and knowing my neighbors.", lightning: "testrunner@example.invalid", leaderboard: true, stage: "On the crew", notes: [{ stage: "Chatted", text: "Good call, knows the west side.", date: now.slice(0, 10), h: 973980 }, { stage: "On the crew", text: "Ride-along went well.", date: now.slice(0, 10), h: 973990 }], createdAt: now.slice(0, 10), h: 973970 },
    { id: "a202", name: "TEST Scout Two", reach: "555 0100 202", area: "Rogers Park", lat: 42.008, lon: -87.668, roles: ["scout", "keeper"], transport: ["transit", "on foot"], hours: "Evenings", why: "I know every laundromat on Howard.", lightning: "test@example.invalid", stage: "Applied", notes: [], createdAt: now.slice(0, 10), h: 973995 },
  ],
  routes: [{ id: "r203", name: "TEST Thursday route", runner: "a201", stops: ["m1"], done: [], createdAt: now.slice(0, 10), h: 973992 }],
  ballots: { m1: [{ option: "s100", backed: false }] },
  suggestions: { m1: [{ id: "s100", name: "TEST hot chips", votes: 3, sats: 0 }, { id: "s101", name: "TEST protein bars", votes: 2, sats: 0 }] },
  counter: 101,
};
state.applicants.push({ id: "a203", name: "TEST Runner Three", reach: "test3@example.invalid", area: "Pilsen", lat: 41.86, lon: -87.66, roles: ["runner"], transport: ["car"], hours: "Weekends", why: "", lightning: "test3@example.invalid", leaderboard: true, stage: "On the crew", notes: [], createdAt: now.slice(0, 10), h: 973960 });
state.machines.push(
  { id: "m204", name: "TEST Cards machine", status: "In storage", type: "cards", prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: { make: "TEST Make", model: "Card-2", serial: "TEST-0204", rawCode: "TEST-0204", cardReader: "", cash: false, lightning: true, telemetry: "none", notes: "" }, slots: [] },
  { id: "m205", name: "TEST Snack machine", status: "In storage", type: "snack", prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: { make: "TEST Make", model: "Spiral-9", serial: "TEST-0205", rawCode: "", cardReader: "", cash: true, lightning: false, telemetry: "none", notes: "" }, slots: [] },
  { id: "m206", name: "TEST Fridge", status: "In repair", type: "fresh", prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: { make: "TEST Make", model: "Cool-3", serial: "TEST-0206", rawCode: "", cardReader: "", cash: false, lightning: false, telemetry: "camera", notes: "Compressor noise." }, slots: [] },
);
// Host the extra test machines at three other real places from the saved Chicago scan, so Places and Machines agree.
import { readFileSync, existsSync } from "node:fs";
const lc = "data/cache/chicago/overpass-laundry.json";
const others = existsSync(lc) ? JSON.parse(readFileSync(lc, "utf8")).items.filter((e) => e.name && `osm-${e.type[0]}${e.id}` !== PROSPECT).slice(0, 3) : [];
for (const [i, e] of others.entries()) {
  const la = e.lat, lo = e.lon, pid = `osm-${e.type[0]}${e.id}`;
  state.tracked[pid] = "Placed";
  state.machines.push({ id: "m21" + i, name: `TEST Machine 0${i + 2}`, status: "Placed", type: "snack", prospectId: pid, hostName: e.name, lat: la, lon: lo, hostSharePct: 10, placedAt: now.slice(0, 10), profile: { make: "", model: "", serial: "", rawCode: "", cardReader: "", cash: true, lightning: false, telemetry: "none", notes: "" }, slots: [slot("A1", "Test chips", "snack", 0.1, 3000)] });
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(state, null, 1));
console.log("wrote", out);
