import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { buildNotices, ordinal, publicCrewName, type NoticeSlice } from "./notices";
import type { Applicant, Machine, Proof } from "./types";

const NOW = 144 * 1000 + 100; // BFT day 1000
const ap = (id: string, extra: Partial<Applicant> = {}): Applicant => ({ id, name: "Maya Garcia", crewName: "maya-g", reach: "", area: "", roles: [], transport: [], hours: "", why: "", stage: "On the crew", notes: [], createdAt: "", ...extra });
const mach = (id: string, extra: Partial<Machine> = {}): Machine => ({ id, name: id.toUpperCase(), status: "Placed", type: "snack", prospectId: "p", hostName: "Laundry Co", hostSharePct: 10, placedAt: "2020-01-01", h: 1, profile: {} as never, slots: [], ...extra });
const proof = (id: string, machine: string, by: string, h: number): Proof => ({ id, kind: "job", ref: "r", machine, by, before: "", after: "", ticked: [], loadTotal: 0, soldOutAtVisit: false, jobKind: "restock", status: "approved", history: [{ status: "approved", at: "2026-01-01T00:00:00Z", h }], sentAt: "", approvedAt: "2026-01-01T00:00:00Z", approvedH: h });
const base = (): NoticeSlice => ({ machines: [mach("m1")], proofs: [], reports: [], applicants: [ap("a1")] });

describe("ordinal", () => { it("handles the teens", () => expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "10th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"])); });

describe("publicCrewName", () => {
  it("is null unless they turned on public showing", () => {
    expect(publicCrewName(ap("a1"))).toBeNull();
    expect(publicCrewName(ap("a1", { leaderboard: true }))).toBe("maya-g.vend@frens");
    expect(publicCrewName(ap("a1", { leaderboard: true, crewName: undefined }))).toBe("Maya G.");
    expect(publicCrewName(ap("a1", { leaderboard: true, stage: "Not now" }))).toBeNull();
  });
  it("a saved profile with jobs shown counts; showJobs false or no record does not", () => {
    const hex = getPublicKey(generateSecretKey()), a = ap("a1", { npub: nip19.npubEncode(hex) });
    const vp = (showJobs: boolean) => ({ [hex]: { blurb: "", availability: "", showArea: false, showJobs, updatedAt: "" } });
    expect(publicCrewName(a, {})).toBeNull();
    expect(publicCrewName(a, vp(false))).toBeNull();
    expect(publicCrewName(a, vp(true))).toBe("maya-g.vend@frens");
  });
});

describe("serviced notices use real counts", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => proof(`p${i}`, "m1", "a1", 144 * 1000 + i)); // n approved today, p0 oldest
  it("says their 10th today from ten real approved proofs, only when they opted in", () => {
    const st = base(); st.applicants = [ap("a1", { leaderboard: true })]; st.proofs = many(10);
    const n = buildNotices(st, NOW).find((x) => x.id === "serviced:p9")!;
    expect(n.text).toContain("Check out maya-g.vend@frens, they just serviced M1 at Laundry Co. That's their 10th service today.");
    expect(n.facts.join(" ")).toContain("10 approved services across the fleet");
  });
  it("hides the crew name and never says an ordinal when they did not opt in", () => {
    const st = base(); st.proofs = many(10);
    const n = buildNotices(st, NOW).find((x) => x.id === "serviced:p9")!;
    expect(n.text).not.toMatch(/maya|Maya|10th|their/);
    expect(n.text).toContain("service number 10 across the fleet today");
  });
  it("counts only that crew's approvals on that BFT day, not other days or other crew", () => {
    const st = base(); st.applicants = [ap("a1", { leaderboard: true }), ap("a2")];
    st.proofs = [proof("old", "m1", "a1", 144 * 999 + 5), proof("other", "m1", "a2", 144 * 1000 + 1), proof("mine", "m1", "a1", 144 * 1000 + 2)];
    const n = buildNotices(st, NOW).find((x) => x.id === "serviced:mine")!;
    expect(n.text).toContain("their 1st service today, 2 in all");
  });
  it("calls a machine placed within a week the new machine, and drops old services", () => {
    const st = base(); st.machines = [mach("m1", { placedAt: "2026-01-01", h: NOW - 100 })]; st.proofs = [proof("p", "m1", "a1", NOW - 5), proof("old", "m1", "a1", NOW - 500)];
    const out = buildNotices(st, NOW);
    expect(out.find((x) => x.id === "serviced:p")!.text).toContain("the new machine M1");
    expect(out.find((x) => x.id === "serviced:old")).toBeUndefined();
  });
});

describe("needs-service notices", () => {
  it("builds from low slots, reports since the last service and overdue time, with no invented numbers", () => {
    const st = base();
    st.machines = [mach("m1", { slots: [
      { code: "A1", name: "x", kind: "snack", level: 0.1, priceSats: 1 }, { code: "A2", name: "y", kind: "snack", level: 0.9, priceSats: 1 }, { code: "P", name: "z", kind: "pickup", level: 0, priceSats: 1 },
    ] })];
    st.proofs = [proof("p", "m1", "a1", NOW - 2000)];
    st.reports = [{ id: "r1", machine: "m1", npub: "n", reason: "empty", text: "", at: "2026-01-01T00:00:00Z", h: NOW - 100 }, { id: "r0", machine: "m1", npub: "n", reason: "old", text: "", at: "", h: NOW - 3000 }];
    const n = buildNotices(st, NOW, "https://v.example").find((x) => x.id === "service:m1")!;
    expect(n.text).toContain("1 of 2 slots are running low");
    expect(n.text).toContain("1 neighbor report since the last service");
    expect(n.text).toContain("2,000 blocks (about 14 BFT days)");
    expect(n.text).toContain("https://v.example/m/m1 #frensvend #FV-M1");
  });
  it("makes nothing for a healthy machine or one that is not placed", () => {
    const st = base(); st.proofs = [proof("p", "m1", "a1", NOW - 3000)]; st.machines = [mach("m1", { status: "In storage", slots: [{ code: "A1", name: "x", kind: "snack", level: 0, priceSats: 1 }] })];
    expect(buildNotices(st, NOW)).toEqual([]);
    st.machines = [mach("m1", { slots: [{ code: "A1", name: "x", kind: "snack", level: 0.9, priceSats: 1 }] })]; st.proofs = [proof("p", "m1", "a1", NOW - 20)];
    expect(buildNotices(st, NOW).filter((x) => x.kind === "service")).toEqual([]);
  });
});
