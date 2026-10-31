// LOCAL TESTING ONLY. Off by default: nothing runs this unless you do.
// Writes a state file full of obviously fake TEST data. Never point production at it.
//   node scripts/seed-local-test.mjs [out-file]      default: data/state.seed.json
//   VEND_STATE_FILE=data/state.seed.json npm run dev
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
  claims: [{ job: "restock:m1", kind: "restock", title: "Restock TEST Machine 01", sats: 7000, by: "a201", at: now, h: 973996 }],
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
    { id: "a201", name: "TEST Runner One", reach: "test1@example.invalid", area: "Pilsen", lat: 41.857, lon: -87.66, roles: ["runner"], transport: ["bike"], hours: "Early mornings", why: "I like being outside and knowing my neighbors.", lightning: "testrunner@example.invalid", stage: "On the crew", notes: [{ stage: "Chatted", text: "Good call, knows the west side.", date: now.slice(0, 10), h: 973980 }, { stage: "On the crew", text: "Ride-along went well.", date: now.slice(0, 10), h: 973990 }], createdAt: now.slice(0, 10), h: 973970 },
    { id: "a202", name: "TEST Scout Two", reach: "555 0100 202", area: "Rogers Park", lat: 42.008, lon: -87.668, roles: ["scout", "keeper"], transport: ["transit", "on foot"], hours: "Evenings", why: "I know every laundromat on Howard.", lightning: "test@example.invalid", stage: "Applied", notes: [], createdAt: now.slice(0, 10), h: 973995 },
  ],
  routes: [{ id: "r203", name: "TEST Thursday route", runner: "a201", stops: ["m1"], done: [], createdAt: now.slice(0, 10), h: 973992 }],
  ballots: { m1: [{ option: "s100", backed: false }] },
  suggestions: { m1: [{ id: "s100", name: "TEST hot chips", votes: 3, sats: 0 }, { id: "s101", name: "TEST protein bars", votes: 2, sats: 0 }] },
  counter: 101,
};
state.machines.push(
  { id: "m204", name: "TEST Cards machine", status: "In storage", type: "cards", prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: { make: "TEST Make", model: "Card-2", serial: "TEST-0204", rawCode: "TEST-0204", cardReader: "", cash: false, lightning: true, telemetry: "none", notes: "" }, slots: [] },
  { id: "m205", name: "TEST Snack machine", status: "In storage", type: "snack", prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: { make: "TEST Make", model: "Spiral-9", serial: "TEST-0205", rawCode: "", cardReader: "", cash: true, lightning: false, telemetry: "none", notes: "" }, slots: [] },
  { id: "m206", name: "TEST Fridge", status: "In repair", type: "fresh", prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: { make: "TEST Make", model: "Cool-3", serial: "TEST-0206", rawCode: "", cardReader: "", cash: false, lightning: false, telemetry: "camera", notes: "Compressor noise." }, slots: [] },
);
for (const [i, [la, lo]] of [[41.825, -87.68], [41.83, -87.675], [41.835, -87.67]].entries()) {
  state.machines.push({ id: "m21" + i, name: `TEST Machine 0${i + 2}`, status: "Placed", type: "snack", prospectId: PROSPECT, hostName: "Su Nueva Lavanderia", lat: la, lon: lo, hostSharePct: 10, placedAt: now.slice(0, 10), profile: { make: "", model: "", serial: "", rawCode: "", cardReader: "", cash: true, lightning: false, telemetry: "none", notes: "" }, slots: [slot("A1", "Test chips", "snack", 0.1, 3000)] });
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(state, null, 1));
console.log("wrote", out);
