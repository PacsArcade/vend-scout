import { describe, expect, it } from "vitest";
import { nip19 } from "nostr-tools";
import { cleanVendFields, keyFromParam, profileActionOk, summaryFor, type Slice } from "./vendprofile";
import type { Applicant, Machine } from "./types";

const HEX_A = "ab".repeat(32), HEX_B = "cd".repeat(32);
const npubA = nip19.npubEncode(HEX_A), npubB = nip19.npubEncode(HEX_B);
const ap = (o: Partial<Applicant>): Applicant => ({ id: "a1", name: "Maya", reach: "m@x.co", area: "x", roles: ["runner"], transport: [], hours: "", why: "", stage: "On the crew", notes: [], createdAt: "2026-01-01", ...o });
const mach = (o: Partial<Machine>): Machine => ({ id: "m1", name: "M1", status: "Placed", type: "snack", prospectId: "p", hostName: "H", hostSharePct: 10, placedAt: "2026-01-01", profile: {} as never, slots: [], lat: 41.82, lon: -87.68, ...o });
const slice = (o: Partial<Slice>): Slice => ({ applicants: [], machines: [], routes: [], claims: [], listings: [], ...o });

describe("profileActionOk (own record only)", () => {
  it("lets a key edit itself, with or without naming itself", () => {
    expect(profileActionOk(HEX_A, HEX_A).ok).toBe(true);
    expect(profileActionOk(HEX_A, null).ok).toBe(true);
  });
  it("refuses someone else's record and a missing session", () => {
    expect(profileActionOk(HEX_A, HEX_B).ok).toBe(false);
    expect(profileActionOk(HEX_A, "bad").ok).toBe(false);
    expect(profileActionOk(null, HEX_A).ok).toBe(false);
  });
});

describe("cleanVendFields", () => {
  it("keeps only known fields, caps length, and keeps old values for fields left out", () => {
    const old = { blurb: "old", availability: "evenings", showArea: true, showJobs: false, updatedAt: "x" };
    const r = cleanVendFields({ blurb: "n".repeat(900), evil: "x" } as never, old, "now", 5);
    expect(r.blurb.length).toBe(400); expect(r.availability).toBe("evenings"); expect(r.showArea).toBe(true); expect(r.showJobs).toBe(false);
    expect(r).not.toHaveProperty("evil"); expect(r.h).toBe(5);
  });
  it("booleans must be real booleans", () => { expect(cleanVendFields({ showArea: "yes" as never }, undefined, "t").showArea).toBe(false); });
});

describe("keyFromParam", () => {
  it("takes an npub or a hex key and rejects junk", () => {
    expect(keyFromParam(npubA)).toEqual({ hex: HEX_A, npub: npubA });
    expect(keyFromParam(HEX_A)?.npub).toBe(npubA);
    expect(keyFromParam("hello")).toBeNull();
  });
});

describe("summaryFor", () => {
  it("shows a crew member with real work and a service area", () => {
    const s = summaryFor(slice({
      applicants: [ap({ npub: npubA, crewName: "maya-g", notes: [{ stage: "On the crew", text: "ok", date: "2026-02-02", h: 900000 }] })],
      machines: [mach({}), mach({ id: "m2", name: "M2", lat: 40.71, lon: -74.0 })],
      routes: [{ id: "r1", name: "R", runner: "a1", stops: ["m1"], done: [{ machine: "m1", at: "t" }], createdAt: "t" }],
      claims: [{ job: "restock:m2", kind: "restock", title: "t", sats: 1, by: "a1", at: "t", doneAt: "t2" }, { job: "restock:m1", kind: "restock", title: "t", sats: 1, by: "a1", at: "t" }, { job: "restock:m1", kind: "restock", title: "t", sats: 1, by: "someone", at: "t", doneAt: "t" }],
    }), HEX_A);
    expect(s).toMatchObject({ onCrew: true, crewName: "maya-g", jobsDone: 2, since: { date: "2026-02-02", h: 900000 } });
    expect(s.servicedMachines.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    expect(s.area.length).toBe(2);
  });
  it("shows an owner without any crew record", () => {
    const s = summaryFor(slice({ machines: [mach({ ownerNpub: npubB })] }), HEX_B);
    expect(s.onCrew).toBe(false); expect(s.ownedMachines.map((m) => m.id)).toEqual(["m1"]); expect(s.area[0]).toMatchObject({ machines: 1, jobs: 0 });
  });
  it("does not reveal an applicant who is not on the crew", () => {
    const s = summaryFor(slice({ applicants: [ap({ npub: npubA, stage: "Applied", crewName: "maya-g" })] }), HEX_A);
    expect(s).toMatchObject({ onCrew: false, crewName: "", roles: [], jobsDone: 0 });
  });
  it("is plainly empty for an unknown key", () => {
    const s = summaryFor(slice({}), HEX_A);
    expect(s).toMatchObject({ onCrew: false, ownedMachines: [], servicedMachines: [], jobsDone: 0, area: [] });
    expect(s.vend.blurb).toBe("");
  });
});

describe("saveProfile through the store", () => {
  it("writes only the given key's record", async () => {
    const { promises: fs } = await import("fs"); const os = await import("os"); const path = await import("path");
    const file = path.join(os.tmpdir(), `vend-prof-test-${process.pid}.json`);
    process.env.VEND_STATE_FILE = file;
    await fs.writeFile(file, "{}");
    const { perform, readState } = await import("./store");
    expect((await perform({ action: "saveProfile", pubkey: HEX_A, fields: { blurb: "hello", showArea: true } })).ok).toBe(true);
    expect((await perform({ action: "saveProfile", pubkey: "nothex", fields: { blurb: "x" } })).ok).toBe(false);
    const st = await readState();
    expect(st.profiles?.[HEX_A]).toMatchObject({ blurb: "hello", showArea: true });
    expect(Object.keys(st.profiles ?? {})).toEqual([HEX_A]);
  });
});
