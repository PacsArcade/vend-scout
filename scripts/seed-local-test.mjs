// LOCAL TESTING ONLY. Off by default: nothing runs this unless you do.
// Writes a state file full of obviously fake TEST data. Never point production at it.
//   node scripts/seed-local-test.mjs [out-file]      default: data/state.seed.json
//   VEND_STATE_FILE=data/state.seed.json npm run dev
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const out = process.argv[2] || "data/state.seed.json";
const now = new Date().toISOString();
const slot = (code, name, kind, level, priceSats) => ({ code, name, kind, level, priceSats });
const state = {
  tracked: {},
  notes: {},
  machines: [{
    id: "m1", name: "TEST Machine 01", host: "TEST Host Laundromat", hostSharePct: 10, placedAt: now.slice(0, 10),
    slots: [
      slot("A1", "Test chips", "snack", 0.1, 3000), slot("A2", "Test crackers", "snack", 0.6, 3000), slot("A3", "Test water", "snack", 0.8, 2000),
      slot("A4", "Test trail mix", "snack", 0.3, 4000), slot("A5", "Test gummies", "snack", 0.9, 3000), slot("A6", "Test cookies", "snack", 0.4, 3500),
      slot("B1", "Arcade sticker pack", "merch", 0.6, 5000), slot("B2", "Arcade mini print", "merch", 0.3, 21000),
      slot("P1", "Arcade mini print", "pickup", 1, 0),
    ],
  }],
  sales: [{ machine: "m1", slot: "A2", item: "Test crackers", sats: 3000, at: now, test: true }, { machine: "m1", slot: "B1", item: "Arcade sticker pack", sats: 5000, at: now, test: true }],
  orders: [{ code: "4219", item: "Arcade mini print", priceSats: 21000, machine: "m1", slot: "P1", createdAt: now, source: "frens.earth (test)" }],
  listings: [
    { id: "l1", n: 1, item: "TEST wildflower honey, 8 oz", kind: "honey", priceSats: 12000, qty: 6, machine: "m1", pickupWindow: "Sat 9 AM to noon", madeBy: "TEST Maker, a backyard hive", status: "approved", createdAt: now.slice(0, 10) },
    { id: "l2", n: 2, item: "TEST farm eggs, dozen", kind: "eggs", priceSats: 9000, qty: 8, machine: "m1", pickupWindow: "Weekdays after 5 PM", madeBy: "TEST Farm, six hens", status: "pending", createdAt: now.slice(0, 10) },
  ],
  ballots: { m1: [{ option: "s100", backed: false }] },
  suggestions: { m1: [{ id: "s100", name: "TEST hot chips", votes: 3, sats: 0 }, { id: "s101", name: "TEST protein bars", votes: 2, sats: 0 }] },
  counter: 101,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(state, null, 1));
console.log("wrote", out);
