import { promises as fs } from "fs";
import path from "path";
import { findProspect } from "./overpass";
import { currentHeight } from "./time";
import { tally } from "./vote";
import type { Listing, ListingStatus, Machine, MachineProfile, Note, PackageStatus, PickupOrder, Report, Sale, ShelfKind, SitePackage, Slot, SlotKind, Stage, VoteOption } from "./types";
import { EMPTY_PROFILE } from "./types";
import { FOOD_KINDS, SHELF_KINDS, STAGES } from "./types";

const STATE = process.env.VEND_STATE_FILE || path.join(process.cwd(), "data", "state.json");

export interface State {
  tracked: Record<string, Stage>;
  notes: Record<string, Note[]>;
  packages: Record<string, SitePackage>;
  machines: Machine[];
  sales: Sale[];
  orders: PickupOrder[];
  listings: Listing[];
  ballots: Record<string, { option: string; backed: boolean }[]>;
  suggestions: Record<string, VoteOption[]>;
  counter: number;
}
const empty = (): State => ({ tracked: {}, notes: {}, packages: {}, machines: [], sales: [], orders: [], listings: [], ballots: {}, suggestions: {}, counter: 0 });

export async function readState(): Promise<State> {
  try {
    return { ...empty(), ...(JSON.parse(await fs.readFile(STATE, "utf8")) as State) };
  } catch {
    return empty();
  }
}
async function write(s: State) {
  await fs.mkdir(path.dirname(STATE), { recursive: true });
  await fs.writeFile(STATE, JSON.stringify(s, null, 1));
}
const today = () => new Date().toISOString().slice(0, 10);
const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
const cleanProfile = (p: MachineProfile): MachineProfile => ({
  make: str(p.make, 60), model: str(p.model, 60), serial: str(p.serial, 80), rawCode: str(p.rawCode, 300), labelPhoto: p.labelPhoto,
  cardReader: str(p.cardReader, 60), cash: !!p.cash, lightning: !!p.lightning,
  telemetry: ["none", "card", "camera", "sensors"].includes(p.telemetry) ? p.telemetry : "none", notes: str(p.notes, 1000),
});
const int = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

export const LOCAL_FOOD_NOTE = "Local food rules apply. Check your local food rules before you list this. This is not legal advice.";
export const isFood = (k: ShelfKind) => FOOD_KINDS.includes(k);

/** Approved local-shelf listings show up as slots of their own colour. */
export function localSlots(st: State, machine: string): (Slot & { listingId: string; maker: string; qty: number })[] {
  return st.listings
    .filter((l) => l.machine === machine && l.status === "approved")
    .map((l) => ({ code: `L${l.n}`, name: l.item, kind: "snack" as SlotKind, level: Math.min(1, l.qty / 12), priceSats: l.priceSats, listingId: l.id, maker: l.madeBy, qty: l.qty }));
}

export type Action =
  | { action: "stage"; id: string; stage: Stage }
  | { action: "note"; id: string; text: string }
  | { action: "addMachine"; name: string; prospectId: string; hostSharePct: number; profile?: Partial<MachineProfile> }
  | { action: "profile"; machine: string; profile: Partial<MachineProfile> }
  | { action: "package"; id: string; status: PackageStatus }
  | { action: "addSlot"; machine: string; name: string; kind: SlotKind; priceSats: number; level: number; report?: Report }
  | { action: "restock"; machine: string }
  | { action: "pay"; machine: string; slot: string }
  | { action: "order"; machine: string; item: string; priceSats: number; orderRef?: string }
  | { action: "listing"; item: string; kind: ShelfKind; priceSats: number; qty: number; machine: string; pickupWindow: string; madeBy: string }
  | { action: "decide"; id: string; status: ListingStatus }
  | { action: "vote"; machine: string; option: string; backed: boolean }
  | { action: "suggest"; machine: string; name: string };

export async function perform(a: Action): Promise<{ ok: boolean; error?: string; id?: string; code?: string }> {
  const st = await readState();
  const h = (await currentHeight()).h || undefined;
  const machine = (id: string) => st.machines.find((m) => m.id === id);
  switch (a.action) {
    case "stage": {
      if (!STAGES.includes(a.stage)) return { ok: false, error: "Unknown stage" };
      st.tracked[a.id] = a.stage;
      break;
    }
    case "note": {
      const text = str(a.text, 500);
      if (!text) return { ok: false, error: "Write something first" };
      st.tracked[a.id] ??= "Found";
      (st.notes[a.id] ??= []).push({ date: today(), h, text });
      break;
    }
    case "addMachine": {
      const name = str(a.name, 60);
      if (!name) return { ok: false, error: "Give the machine a name" };
      if (!a.prospectId) return { ok: false, error: "Pick the place that hosts it. A machine is placed at a prospect." };
      const p = await findProspect(a.prospectId);
      if (!p) return { ok: false, error: "That place is not in the scan data. Track it from the map first." };
      const id = `m${++st.counter}`;
      st.machines.push({ id, name, prospectId: a.prospectId, hostName: p.prospect.name, hostSharePct: int(a.hostSharePct, 0, 50), lat: p.prospect.lat, lon: p.prospect.lon, placedAt: today(), h, profile: cleanProfile({ ...EMPTY_PROFILE, ...(a.profile ?? {}) }), slots: [] });
      st.tracked[a.prospectId] = "Placed";
      await write(st);
      return { ok: true, id };
    }
    case "profile": {
      const m = machine(a.machine);
      if (!m) return { ok: false, error: "No such machine" };
      m.profile = cleanProfile({ ...m.profile, ...a.profile, labelPhoto: m.profile.labelPhoto });
      break;
    }
    case "package": {
      if (!["drafted", "offered", "accepted"].includes(a.status)) return { ok: false, error: "Unknown status" };
      st.packages[a.id] = { status: a.status, updatedAt: today(), h };
      st.tracked[a.id] ??= "Found";
      break;
    }
    case "addSlot": {
      const m = machine(a.machine);
      const name = str(a.name, 40);
      if (!m || !name) return { ok: false, error: "A machine and an item name are needed" };
      const kind: SlotKind = a.kind === "merch" ? "merch" : "snack";
      const n = m.slots.filter((s) => s.kind !== "pickup").length;
      const code = `${"ABCD"[Math.floor(n / 6)] ?? "E"}${(n % 6) + 1}`;
      m.slots.push({ code, name, kind, level: int(a.level, 0, 100) / 100, priceSats: int(a.priceSats, 1, 100_000_000), report: a.report === "sensor" ? "sensor" : "hand" });
      break;
    }
    case "restock": {
      const m = machine(a.machine);
      if (!m) return { ok: false, error: "No such machine" };
      for (const s of m.slots) if (s.kind !== "pickup" && s.level < 0.45) s.level = 1;
      break;
    }
    case "pay": {
      const m = machine(a.machine);
      if (!m) return { ok: false, error: "No such machine" };
      const slot = m.slots.find((s) => s.code === a.slot);
      if (slot) {
        slot.level = Math.max(0, slot.level - 0.1);
        st.sales.push({ machine: m.id, slot: slot.code, item: slot.name, sats: slot.priceSats, at: new Date().toISOString(), h, test: true });
      } else {
        const l = st.listings.find((x) => x.machine === m.id && `L${x.n}` === a.slot && x.status === "approved");
        if (!l || l.qty < 1) return { ok: false, error: "Nothing left in that slot" };
        l.qty -= 1;
        st.sales.push({ machine: m.id, slot: a.slot, item: l.item, sats: l.priceSats, at: new Date().toISOString(), h, test: true, maker: l.madeBy });
      }
      break;
    }
    case "order": {
      const m = machine(a.machine);
      const item = str(a.item, 80);
      if (!m || !item) return { ok: false, error: "A machine and an item are needed" };
      const n = m.slots.filter((s) => s.kind === "pickup").length + 1;
      const slot = `P${n}`;
      m.slots.push({ code: slot, name: item, kind: "pickup", level: 1, priceSats: 0 });
      let code = "";
      do code = String(Math.floor(1000 + Math.random() * 9000)); while (st.orders.some((o) => o.code === code));
      st.orders.push({ code, item, priceSats: int(a.priceSats, 0, 100_000_000), machine: m.id, slot, createdAt: new Date().toISOString(), h, source: a.orderRef ? `frens.earth ${str(a.orderRef, 40)}` : "frens.earth (typed in)" });
      await write(st);
      return { ok: true, code };
    }
    case "listing": {
      const m = machine(a.machine);
      const item = str(a.item, 60), madeBy = str(a.madeBy, 120), pickupWindow = str(a.pickupWindow, 60);
      if (!m) return { ok: false, error: "Pick a machine first" };
      if (!item || !madeBy || !pickupWindow) return { ok: false, error: "Item, pickup window and a made-by line are needed" };
      const kind = SHELF_KINDS.includes(a.kind) ? a.kind : "other";
      const n = ++st.counter;
      const id = `l${n}`;
      st.listings.push({ id, n, item, kind, priceSats: int(a.priceSats, 1, 100_000_000), qty: int(a.qty, 1, 500), machine: m.id, pickupWindow, madeBy, status: "pending", createdAt: today(), h });
      await write(st);
      return { ok: true, id };
    }
    case "decide": {
      const l = st.listings.find((x) => x.id === a.id);
      if (!l || (a.status !== "approved" && a.status !== "declined")) return { ok: false, error: "No such listing" };
      l.status = a.status;
      break;
    }
    case "vote": {
      if (!machine(a.machine)) return { ok: false, error: "No such machine" };
      (st.ballots[a.machine] ??= []).push({ option: a.option, backed: !!a.backed });
      break;
    }
    case "suggest": {
      const name = str(a.name, 40);
      if (!machine(a.machine) || !name) return { ok: false, error: "Type an item first" };
      (st.suggestions[a.machine] ??= []).push({ id: "s" + ++st.counter, name, votes: 1, sats: 0 });
      break;
    }
    default:
      return { ok: false, error: "Unknown action" };
  }
  await write(st);
  return { ok: true };
}

export async function getVotes(machine: string) {
  const st = await readState();
  return tally(st.suggestions[machine] ?? [], st.ballots[machine] ?? []);
}

export function salesSummary(st: State, machine: string) {
  const mine = st.sales.filter((s) => s.machine === machine);
  const day = new Date().toISOString().slice(0, 10);
  const weekAgo = Date.now() - 7 * 86400_000;
  const sum = (xs: Sale[]) => xs.reduce((a, s) => a + s.sats, 0);
  return { today: sum(mine.filter((s) => s.at.slice(0, 10) === day)), week: sum(mine.filter((s) => Date.parse(s.at) >= weekAgo)), total: sum(mine), count: mine.length };
}
export type { Note };

export async function setLabelPhoto(machineId: string, file: string): Promise<boolean> {
  const st = await readState();
  const m = st.machines.find((x) => x.id === machineId);
  if (!m) return false;
  m.profile.labelPhoto = file;
  await write(st);
  return true;
}
