import { readStateText, writeStateText } from "./blobstore";
import { findProspect } from "./overpass";
import { currentHeight } from "./time";
import { tally } from "./vote";
import type { Listing, ListingStatus, Machine, MachineProfile, Note, PackageStatus, PickupOrder, Report, Sale, ShelfKind, SitePackage, Slot, SlotKind, Stage, VoteOption } from "./types";
import { EMPTY_PROFILE, APPLICANT_STAGES, CREW_ROLES, OUTREACH_HOW, TRANSPORT } from "./types";
import { validLightning } from "./lightning";
import { npubToHex } from "./operator";
import { rateFeed } from "./rate";
import { satsFor } from "./crew";
import { GIG } from "./gig";
import { openJobs } from "./jobs";
import { ILLINOIS } from "./places";
import { payout } from "./payout";
import type { ScoutAward, ScoutCheck, Inside, MachineState } from "./types";
import { INSIDE_LABEL, MACHINE_STATES } from "./types";
import { scoutAward } from "./arcade";
import type { AiLogEntry, AiVerdict, Block, Item, PayoutRec, Proof } from "./types";
import { checkProof, ollamaUrl, skippedVerdict } from "./autoCheck";
import { comboBonus, scoreStop, streakDays } from "./arcade";
import type { Claim, HostPick, JobKind, MachineStatus, MachineType } from "./types";
import { MACHINE_STATUSES, MACHINE_TYPES } from "./types";
import type { Applicant, ApplicantStage, CrewRole, Outreach, OutreachHow, Route } from "./types";
import { FOOD_KINDS, SHELF_KINDS, STAGES } from "./types";


export interface State {
  tracked: Record<string, Stage>;
  notes: Record<string, Note[]>;
  packages: Record<string, SitePackage>;
  outreach: Record<string, Outreach[]>;
  hostPicks: Record<string, HostPick>;
  online: Record<string, boolean>;
  passes: Record<string, string[]>;
  seen: Record<string, number>;
  blocks: Block[];
  payouts: PayoutRec[];
  proofs: Proof[];
  items: Item[];
  checks: Record<string, ScoutCheck>;
  scoutAwards: ScoutAward[];
  aiLog: AiLogEntry[];
  claims: Claim[];
  applicants: Applicant[];
  routes: Route[];
  machines: Machine[];
  sales: Sale[];
  orders: PickupOrder[];
  listings: Listing[];
  ballots: Record<string, { option: string; backed: boolean }[]>;
  suggestions: Record<string, VoteOption[]>;
  counter: number;
}
const empty = (): State => ({ tracked: {}, notes: {}, packages: {}, outreach: {}, hostPicks: {}, online: {}, passes: {}, seen: {}, blocks: [], payouts: [], proofs: [], items: [], checks: {}, scoutAwards: [], aiLog: [], claims: [], applicants: [], routes: [], machines: [], sales: [], orders: [], listings: [], ballots: {}, suggestions: {}, counter: 0 });

export async function readState(): Promise<State> {
  try {
    const st = { ...empty(), ...(JSON.parse((await readStateText()) ?? "{}") as State) };
    // Older records had no status or type: a machine with a host was placed, one without is in storage.
    for (const m of st.machines) {
      m.prospectId ??= ""; m.hostName ??= "";
      m.status ??= m.prospectId ? "Placed" : "In storage";
      m.type ??= "snack";
      m.profile = { ...EMPTY_PROFILE, ...m.profile };
    }
    for (const l of st.listings) l.lightning ??= "";
    return st;
  } catch {
    return empty();
  }
}
async function write(s: State) {
  await writeStateText(JSON.stringify(s, null, 1));
}
const nowIso = () => new Date().toISOString();
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
  | { action: "addInventory"; name: string; type: MachineType; typeOther?: string; profile?: Partial<MachineProfile> }
  | { action: "placeMachine"; machine: string; prospectId: string; hostSharePct: number }
  | { action: "restockJob"; machine: string }
  | { action: "backInService"; machine: string }
  | { action: "machineStatus"; machine: string; status: MachineStatus }
  | { action: "hostPick"; prospectId: string; types: MachineType[]; other: string; note: string }
  | { action: "seenJobs"; ids: string[] }
  | { action: "goOnline"; id: string; on: boolean }
  | { action: "passJob"; by: string; job: string }
  | { action: "scheduleBlock"; by: string; city: string; startInH: number; lengthH: number }
  | { action: "onboard"; id: string; lightning?: string; city?: string; lat?: number; lon?: number }
  | { action: "advance"; kind: "applicant" | "site"; id: string }
  | { action: "claimJob"; job: string; kind: JobKind; title: string; by: string }
  | { action: "submitProof"; kind: "job" | "stop"; ref: string; route?: string; machine?: string; before: string; after: string; ticked: string[]; loadTotal: number }
  | { action: "reviewProof"; id: string; decision: "approve" | "retake"; reason?: string; glassClean?: boolean; loadMatches?: boolean }
  | { action: "ackPop"; id: string }
  | { action: "addItem"; name: string; size: string; priceSats: number; photo?: string }
  | { action: "recordAi"; id: string; verdict: AiVerdict }
  | { action: "runAi"; id: string }
  | { action: "setLeaderboard"; id: string; on: boolean }
  | { action: "outreach"; id: string; who: string; how: OutreachHow; outcome: string; note: string }
  | { action: "scoutCheck"; id: string; inside: Inside; who: string; state?: MachineState; room: "yes" | "no" | "unsure"; photo?: string; by?: string }
  | { action: "attachNpub"; id: string; npub: string }
  | { action: "apply"; hp?: string; npub?: string; name: string; reach: string; area: string; lat?: number; lon?: number; roles: CrewRole[]; transport: string[]; hours: string; why: string; lightning?: string }
  | { action: "applicantStep"; id: string; stage: ApplicantStage; note: string }
  | { action: "createRoute"; name: string; runner?: string; stops: string[] }
  | { action: "routeRunner"; id: string; runner: string }
  | { action: "profile"; machine: string; profile: Partial<MachineProfile> }
  | { action: "package"; id: string; status: PackageStatus }
  | { action: "addSlot"; machine: string; name: string; kind: SlotKind; priceSats: number; level: number; report?: Report; itemId?: string }
  | { action: "restock"; machine: string }
  | { action: "pay"; machine: string; slot: string }
  | { action: "order"; machine: string; item: string; priceSats: number; orderRef?: string }
  | { action: "listing"; item: string; kind: ShelfKind; priceSats: number; qty: number; machine: string; pickupWindow: string; madeBy: string; lightning: string }
  | { action: "decide"; id: string; status: ListingStatus }
  | { action: "vote"; machine: string; option: string; backed: boolean }
  | { action: "suggest"; machine: string; name: string };

export async function perform(a: Action): Promise<{ ok: boolean; error?: string; id?: string; code?: string; note?: string }> {
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
    case "addInventory": {
      const name = str(a.name, 60);
      if (!name) return { ok: false, error: "Give the machine a name" };
      const type: MachineType = MACHINE_TYPES.includes(a.type) ? a.type : "other";
      const id = `m${++st.counter}`;
      st.machines.push({ id, name, status: "In storage", type, typeOther: type === "other" ? str(a.typeOther, 60) || undefined : undefined, prospectId: "", hostName: "", hostSharePct: 10, placedAt: "", profile: cleanProfile({ ...EMPTY_PROFILE, ...(a.profile ?? {}) }), slots: [], addedAt: today() });
      await write(st);
      return { ok: true, id };
    }
    case "placeMachine": {
      const m = machine(a.machine);
      if (!m) return { ok: false, error: "Pick a machine from inventory" };
      if (m.status !== "In storage") return { ok: false, error: `Only a machine that is In storage can be placed. This one is ${m.status}.` };
      if (!a.prospectId) return { ok: false, error: "Pick the place that hosts it. A machine is placed at a prospect." };
      const p = await findProspect(a.prospectId);
      if (!p) return { ok: false, error: "That place is not in the scan data. Track it from the map first." };
      Object.assign(m, { status: "Placed", prospectId: a.prospectId, hostName: p.prospect.name, hostSharePct: int(a.hostSharePct, 0, 50), lat: p.prospect.lat, lon: p.prospect.lon, placedAt: today(), h });
      st.tracked[a.prospectId] = "Placed";
      break;
    }
    case "restockJob": {
      const m = machine(a.machine);
      if (!m || m.status !== "Placed") return { ok: false, error: "Only a placed machine can get a restock job" };
      m.restockRequested = true;
      break;
    }
    case "backInService": {
      const m = machine(a.machine);
      if (!m || m.status !== "In repair" || !m.prospectId) return { ok: false, error: "That machine is not in repair at a host" };
      m.status = "Placed";
      break;
    }
    case "machineStatus": {
      const m = machine(a.machine);
      if (!m || !MACHINE_STATUSES.includes(a.status) || a.status === "Placed") return { ok: false, error: "Use Place a machine to place one" };
      if (m.status === "Placed" && a.status !== "In repair") Object.assign(m, { prospectId: "", hostName: "", lat: undefined, lon: undefined, placedAt: "" });
      m.status = a.status;
      break;
    }
    case "hostPick": {
      if (!(await findProspect(a.prospectId))) return { ok: false, error: "No such place" };
      const types = (a.types ?? []).filter((t) => MACHINE_TYPES.includes(t));
      if (types.length === 0 && !str(a.other, 80)) return { ok: false, error: "Pick at least one kind of machine, or tell us what you have in mind" };
      st.hostPicks[a.prospectId] = { types, other: str(a.other, 80), note: str(a.note, 500), date: today(), h };
      st.tracked[a.prospectId] ??= "Found";
      break;
    }
    case "seenJobs": {
      const t = Date.now();
      for (const id of (a.ids ?? []).slice(0, 500)) st.seen[id] ??= t;
      break;
    }
    case "goOnline": {
      const ap = st.applicants.find((x) => x.id === a.id && x.stage === "On the crew");
      if (!ap) return { ok: false, error: "Only someone On the crew can go online" };
      st.online[a.id] = !!a.on;
      break;
    }
    case "passJob": {
      // Passing never hurts: it only hides the offer from this worker. No score, no penalty.
      (st.passes[a.by] ??= []).push(a.job);
      break;
    }
    case "scheduleBlock": {
      const ap = st.applicants.find((x) => x.id === a.by && x.stage === "On the crew");
      const city = ILLINOIS.find((c) => c.slug === a.city);
      if (!ap || !city) return { ok: false, error: "Pick who you are and a city" };
      const startIn = GIG.startHours.includes(a.startInH) ? a.startInH : 1, len = GIG.lengthHours.includes(a.lengthH) ? a.lengthH : 2;
      const start = Date.now() + startIn * 3600_000;
      st.blocks.push({ id: `b${++st.counter}`, by: a.by, city: city.slug, cityName: city.name, startAt: new Date(start).toISOString(), endAt: new Date(start + len * 3600_000).toISOString(), h });
      break;
    }
    case "onboard": {
      const ap = st.applicants.find((x) => x.id === a.id && x.stage === "On the crew");
      if (!ap) return { ok: false, error: "Only someone On the crew can set this up" };
      if (a.lightning !== undefined && a.lightning !== "") { const ln = validLightning(a.lightning); if (!ln.ok) return { ok: false, error: ln.error }; ap.lightning = ln.value; }
      if (a.city) { const c = ILLINOIS.find((x) => x.slug === a.city); if (c) { ap.area = c.name; ap.lat = (c.bbox.south + c.bbox.north) / 2; ap.lon = (c.bbox.west + c.bbox.east) / 2; } }
      else if (Number.isFinite(a.lat) && Number.isFinite(a.lon)) { ap.lat = a.lat; ap.lon = a.lon; ap.area ||= "My location"; }
      break;
    }
    case "advance": {
      if (a.kind === "applicant") {
        const ap = st.applicants.find((x) => x.id === a.id);
        const order: ApplicantStage[] = ["Applied", "Chatted", "Ride-along", "On the crew"];
        const i = ap ? order.indexOf(ap.stage) : -1;
        if (!ap || i < 0 || i >= order.length - 1) return { ok: false, error: "No next step" };
        ap.stage = order[i + 1]; ap.notes.push({ stage: ap.stage, text: "Moved on from the admin board.", date: today(), h });
      } else {
        const pk = st.packages[a.id];
        const order = ["drafted", "offered", "accepted"] as const;
        const i = pk ? order.indexOf(pk.status) : -1;
        if (!pk || i < 0 || i >= order.length - 1) return { ok: false, error: "No next step" };
        st.packages[a.id] = { status: order[i + 1], updatedAt: today(), h };
      }
      break;
    }
    case "claimJob": {
      const by = st.applicants.find((x) => x.id === a.by && x.stage === "On the crew");
      if (!by) return { ok: false, error: "Only someone On the crew can claim a job" };
      if (st.claims.some((c) => c.job === a.job)) return { ok: false, error: "Someone already claimed that job" };
      if (!(["restock", "scout", "shelf", "tech"] as string[]).includes(a.kind)) return { ok: false, error: "Unknown job" };
      const rate = await rateFeed.rate();
      const open = (await openJobs(st)).jobs.find((j) => j.id === a.job);
      const bonus = open?.bonus ?? 0;
      st.claims.push({ job: str(a.job, 80), kind: a.kind, title: str(a.title, 120), sats: satsFor(a.kind, rate.satsPerUsd) + bonus, bonus, by: by.id, at: new Date().toISOString(), h });
      break;
    }
    case "outreach": {
      const who = str(a.who, 80), note = str(a.note, 500);
      if (!who) return { ok: false, error: "Who did you reach?" };
      if (!OUTREACH_HOW.includes(a.how)) return { ok: false, error: "Pick how you reached them" };
      st.tracked[a.id] ??= "Found";
      (st.outreach[a.id] ??= []).push({ who, how: a.how, outcome: str(a.outcome, 40), note, date: today(), h });
      break;
    }
    case "apply": {
      if (a.hp) return { ok: true }; // honeypot: a bot filled the hidden field. Pretend it worked, save nothing.
      const name = str(a.name, 80), reach = str(a.reach, 120), why = str(a.why, 1000);
      if (!name || !reach) return { ok: false, error: "A name and a way to reach you are needed" };
      if (!reach.includes("@") && reach.replace(/\D/g, "").length < 7) return { ok: false, error: "Give an email or a phone number we can use" };
      if (a.lightning && str(a.lightning, 200)) { const ln = validLightning(a.lightning); if (!ln.ok) return { ok: false, error: ln.error }; }
      let npub: string | undefined;
      if (a.npub && str(a.npub, 100)) {
        const hex = npubToHex(a.npub);
        if (!hex) return { ok: false, error: "That does not look like an npub. It starts with npub1" };
        if (st.applicants.some((x) => x.npub && npubToHex(x.npub) === hex)) return { ok: false, error: "That npub is already linked to an application" };
        npub = a.npub.trim();
      }
      const roles = (a.roles ?? []).filter((r) => CREW_ROLES.includes(r));
      if (roles.length === 0) return { ok: false, error: "Pick at least one role" };
      const n = ++st.counter;
      const lat = Number.isFinite(a.lat) ? Number(a.lat) : undefined, lon = Number.isFinite(a.lon) ? Number(a.lon) : undefined;
      st.applicants.push({ id: `a${n}`, npub, name, reach, area: str(a.area, 80), lat, lon, roles, transport: (a.transport ?? []).filter((t) => (TRANSPORT as readonly string[]).includes(t)), hours: str(a.hours, 120), why, lightning: a.lightning && str(a.lightning, 200) ? validLightning(a.lightning).value : undefined, stage: "Applied", notes: [], createdAt: today(), h });
      await write(st);
      return { ok: true, id: `a${n}` };
    }
    case "scoutCheck": {
      if (!(a.inside in INSIDE_LABEL)) return { ok: false, error: "Pick what is already inside" };
      if (!(await findProspect(a.id))) return { ok: false, error: "No such place" };
      const hasMachine = ["snacks", "drinks", "combo"].includes(a.inside);
      const chk: ScoutCheck = { inside: a.inside, who: str(a.who, 80), state: hasMachine && MACHINE_STATES.includes(a.state as MachineState) ? a.state : undefined, room: ["yes", "no", "unsure"].includes(a.room) ? a.room : "unsure", photo: a.photo && /^[\w.-]+$/.test(a.photo) ? a.photo : st.checks[a.id]?.photo, by: a.by && st.applicants.some((x) => x.id === a.by) ? a.by : undefined, at: today(), h };
      st.checks[a.id] = chk;
      st.tracked[a.id] ??= "Found";
      // Points for a scout who did the check. One award per place and scout, rewritten when the check is updated. Never for speed.
      st.scoutAwards = st.scoutAwards.filter((x) => !(x.prospect === a.id));
      if (chk.by) { const sc = scoutAward(chk); st.scoutAwards.push({ id: `sa${++st.counter}`, by: chk.by, prospect: a.id, points: sc.points, breakdown: sc.breakdown, at: nowIso() }); }
      break;
    }
    case "attachNpub": {
      const ap = st.applicants.find((x) => x.id === a.id);
      const hex = npubToHex(a.npub ?? "");
      if (!ap) return { ok: false, error: "No such applicant" };
      if (!hex) return { ok: false, error: "That does not look like an npub. It starts with npub1" };
      if (st.applicants.some((x) => x.id !== ap.id && x.npub && npubToHex(x.npub) === hex)) return { ok: false, error: "That npub is already linked to someone else" };
      ap.npub = a.npub.trim();
      break;
    }
    case "applicantStep": {
      const ap = st.applicants.find((x) => x.id === a.id);
      if (!ap || !APPLICANT_STAGES.includes(a.stage)) return { ok: false, error: "No such applicant" };
      ap.stage = a.stage;
      const note = str(a.note, 500);
      ap.notes.push({ stage: a.stage, text: note || "Moved here.", date: today(), h });
      break;
    }
    case "createRoute": {
      const name = str(a.name, 60);
      const stops = (a.stops ?? []).filter((id) => machine(id));
      if (!name) return { ok: false, error: "Give the route a name" };
      if (stops.length === 0) return { ok: false, error: "Add at least one stop" };
      if (a.runner && !st.applicants.some((x) => x.id === a.runner && x.stage === "On the crew")) return { ok: false, error: "A runner has to be On the crew" };
      const n = ++st.counter;
      st.routes.push({ id: `r${n}`, name, runner: a.runner || undefined, stops, done: [], createdAt: today(), h });
      await write(st);
      return { ok: true, id: `r${n}` };
    }
    case "routeRunner": {
      const r = st.routes.find((x) => x.id === a.id);
      if (!r) return { ok: false, error: "No such route" };
      if (a.runner && !st.applicants.some((x) => x.id === a.runner && x.stage === "On the crew")) return { ok: false, error: "A runner has to be On the crew" };
      if (a.runner && r.runner && r.runner !== a.runner && r.done.length > 0) return { ok: false, error: "This route is already under way" };
      r.runner = a.runner || undefined;
      break;
    }
    case "submitProof": {
      const okName = (f: string) => /^r\d+-\d+\.(jpg|png|webp)$/.test(f);
      if (!okName(a.before) || !okName(a.after)) return { ok: false, error: "Add both photos: the glass before and after" };
      let by = "", machineId = a.machine, jobKind: JobKind = "restock", ref = a.ref;
      if (a.kind === "job") {
        const c = st.claims.find((x) => x.job === a.ref);
        if (!c) return { ok: false, error: "That job is not claimed" };
        if (c.doneAt) return { ok: false, error: "That job is already paid" };
        by = c.by; jobKind = c.kind; machineId = a.ref.includes(":") ? a.ref.split(":")[1] : machineId;
        if (c.kind === "shelf") machineId = st.listings.find((l) => l.id === a.ref.split(":")[1])?.machine;
      } else {
        const r = st.routes.find((x) => x.id === a.route);
        if (!r || !r.runner || !a.machine || !r.stops.includes(a.machine)) return { ok: false, error: "That stop is not on a route with a runner" };
        if (r.done.some((d) => d.machine === a.machine)) return { ok: false, error: "That stop is already paid" };
        by = r.runner; ref = `route:${r.id}:${a.machine}`;
      }
      const m = machine(machineId ?? "");
      const soldOut = !!m && m.slots.some((s) => s.kind !== "pickup" && s.level <= 0);
      const now = new Date().toISOString();
      const ev = { status: "sent" as const, at: now, h };
      let p = st.proofs.find((x) => x.ref === ref);
      if (p && p.status !== "retake") return { ok: false, error: p.status === "approved" ? "That proof was already approved" : "Proof is already in and waiting for a check" };
      const body = { before: a.before, after: a.after, ticked: (a.ticked ?? []).map((t) => str(t, 8)).slice(0, 60), loadTotal: int(a.loadTotal, 0, 60) };
      if (p) { Object.assign(p, body, { status: "sent" as const, reason: undefined }); p.history.push(ev); }
      else { p = { id: `p${++st.counter}`, kind: a.kind, ref, route: a.route, machine: machineId, by, jobKind, soldOutAtVisit: soldOut, status: "sent", history: [ev], sentAt: now, ...body }; st.proofs.push(p); }
      // Shadow mode: the AI check runs in the background and only suggests. Nothing here approves or pays.
      p.loadItems = m ? m.slots.filter((s) => s.kind !== "pickup" && s.level < 0.45).map((s) => { const it = s.itemId ? st.items.find((x) => x.id === s.itemId) : undefined; return { slot: s.code, item: it?.name ?? s.name, ref: it?.photo }; }) : [];
      p.ai = ollamaUrl() ? undefined : skippedVerdict(); // no checker here: straight to a person, no waiting
      await write(st);
      if (ollamaUrl() && process.env.VEND_AI_CHECK !== "off") void perform({ action: "runAi", id: p.id });
      return { ok: true, id: p.id, note: "Proof sent. You are paid after it is checked." };
    }
    case "reviewProof": {
      const p = st.proofs.find((x) => x.id === a.id);
      if (!p) return { ok: false, error: "No such proof" };
      if (p.status !== "sent") return { ok: false, error: "Already handled. Nothing paid twice." };
      if (p.ai) {
        const humanGood = a.decision === "approve" && a.glassClean === true && a.loadMatches === true;
        st.aiLog.push({ proof: p.id, at: new Date().toISOString(), h, aiOverall: p.ai.overall, aiGlass: p.ai.glassClean, aiLoad: p.ai.loadMatches, humanDecision: a.decision, humanGlass: a.glassClean === true, humanLoad: a.loadMatches === true, agree: (p.ai.overall === "pass") === humanGood, before: p.before, after: p.after, title: st.claims.find((c) => c.job === p.ref)?.title ?? `Stop on ${st.routes.find((r) => r.id === p.route)?.name ?? "a route"}` });
      }
      if (a.decision === "retake") {
        const reason = str(a.reason, 300);
        if (!reason) return { ok: false, error: "Say what to retake" };
        p.status = "retake"; p.reason = reason; p.history.push({ status: "retake", at: new Date().toISOString(), h, note: reason });
        break;
      }
      // approve: score, pay, and only now finish the job or stop
      const nowIso = new Date().toISOString();
      const today0 = nowIso.slice(0, 10);
      const dates = st.proofs.filter((x) => x.by === p.by && x.status === "approved" && x.approvedAt).map((x) => x.approvedAt!.slice(0, 10));
      const sentMs = Date.parse(p.sentAt);
      const inBlock = st.blocks.some((b) => b.by === p.by && Date.parse(b.startAt) <= sentMs && sentMs <= Date.parse(b.endAt));
      const sc = scoreStop({ loadTotal: p.loadTotal, ticked: p.ticked.length, checkerSaysLoadMatches: a.loadMatches === true, checkerSaysGlassClean: a.glassClean === true, soldOutAtVisit: p.soldOutAtVisit, localDelivered: p.jobKind === "shelf", inBlock, streakDays: streakDays([...dates, today0], today0) });
      p.points = sc.points; p.breakdown = sc.breakdown; p.status = "approved"; p.approvedAt = nowIso; p.approvedH = h; p.history.push({ status: "approved", at: nowIso, h });
      let sats = 0, note = "";
      if (p.kind === "job") {
        const c = st.claims.find((x) => x.job === p.ref);
        if (c) { if (p.machine) { const pm = machine(p.machine); if (pm) pm.restockRequested = false; } c.doneAt = nowIso; c.doneH = h; sats = c.sats; c.paidSats = sats; note = await payCrew(st, c.by, sats, c.title, c.job, h); }
      } else {
        const r = st.routes.find((x) => x.id === p.route);
        if (r) {
          r.done.push({ machine: p.machine!, at: nowIso, h, photo: p.after });
          sats = satsFor("restock", (await rateFeed.rate()).satsPerUsd);
          note = await payCrew(st, p.by, sats, `Stop on ${r.name}`, p.ref, h);
          const routeProofs = st.proofs.filter((x) => x.route === r.id);
          if (r.done.length === r.stops.length && routeProofs.every((x) => !x.history.some((e) => e.status === "retake"))) {
            const extra = comboBonus(routeProofs.reduce((a2, x) => a2 + (x.points ?? 0), 0));
            p.points += extra; p.breakdown.push({ label: "Clean route combo", points: extra });
          }
        }
      }
      p.paidSats = sats;
      await write(st);
      return { ok: true, note };
    }
    case "runAi": {
      const id = a.id;
      const p0 = st.proofs.find((x) => x.id === id);
      if (!p0) return { ok: false, error: "No such proof" };
      const verdict = await checkProof({ before: p0.before, after: p0.after, loadItems: p0.loadItems ?? [] });
      return perform({ action: "recordAi", id, verdict });
    }
    case "recordAi": {
      const p0 = st.proofs.find((x) => x.id === a.id);
      if (!p0 || p0.status === "approved") return { ok: false, error: "Not recorded" };
      p0.ai = a.verdict; // a suggestion only. No payout, no approval, ever, from this path.
      break;
    }
    case "addItem": {
      const name = str(a.name, 60);
      if (!name) return { ok: false, error: "Give the item a name" };
      const id = `i${++st.counter}`;
      st.items.push({ id, name, size: str(a.size, 40) || "standard", priceSats: int(a.priceSats, 1, 100_000_000), photo: a.photo && /^[\w.-]+$/.test(a.photo) ? a.photo : undefined });
      await write(st);
      return { ok: true, id };
    }
    case "ackPop": {
      const p = st.proofs.find((x) => x.id === a.id);
      if (p) p.popSeen = true;
      break;
    }
    case "setLeaderboard": {
      const ap = st.applicants.find((x) => x.id === a.id);
      if (!ap) return { ok: false, error: "No such person" };
      ap.leaderboard = !!a.on;
      break;
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
      const name = str(a.name, 40) || (a.itemId ? st.items.find((x) => x.id === a.itemId)?.name ?? "" : "");
      if (!m || !name) return { ok: false, error: "A machine and an item name are needed" };
      const it = a.itemId ? st.items.find((x) => x.id === a.itemId) : undefined;
      const kind: SlotKind = a.kind === "merch" ? "merch" : "snack";
      const n = m.slots.filter((s) => s.kind !== "pickup").length;
      const code = `${"ABCD"[Math.floor(n / 6)] ?? "E"}${(n % 6) + 1}`;
      m.slots.push({ code, name: it?.name ?? name, kind, level: int(a.level, 0, 100) / 100, priceSats: it ? it.priceSats : int(a.priceSats, 1, 100_000_000), report: a.report === "sensor" ? "sensor" : "hand", itemId: it?.id });
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
      const ln = validLightning(a.lightning ?? "");
      if (!ln.ok) return { ok: false, error: ln.error };
      const kind = SHELF_KINDS.includes(a.kind) ? a.kind : "other";
      const n = ++st.counter;
      const id = `l${n}`;
      st.listings.push({ id, n, item, kind, priceSats: int(a.priceSats, 1, 100_000_000), qty: int(a.qty, 1, 500), machine: m.id, pickupWindow, madeBy, lightning: ln.value, status: "pending", createdAt: today(), h });
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


/** Pay a crew member after a finished job. The Payout is a stub, so nothing is sent. Every payout is logged for the earnings page. */
async function payCrew(st: State, by: string, sats: number, reason: string, job: string, h?: number): Promise<string> {
  const to = st.applicants.find((x) => x.id === by)?.lightning;
  if (!to) { st.payouts.push({ by, sats, reason, at: new Date().toISOString(), h, job, sent: false }); return `Job done. Add your Lightning address to be paid ${sats.toLocaleString("en-US")} sats.`; }
  await payout.send({ to, sats, reason });
  st.payouts.push({ by, sats, reason, at: new Date().toISOString(), h, job, sent: false });
  return `Paid ${sats.toLocaleString("en-US")} sats (test, nothing is really sent yet).`;
}
