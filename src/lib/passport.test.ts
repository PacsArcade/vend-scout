import { describe, expect, it } from "vitest";
import { passportFor, type PassportSlice } from "./passport";

const base = (): PassportSlice => ({
  machines: [{ id: "m1", name: "M1", status: "Placed", type: "snack", prospectId: "p", hostName: "Laundry Co", hostSharePct: 10, placedAt: "2026-03-01", addedAt: "2026-02-01", profile: {} as never, slots: [] }],
  proofs: [{ id: "p1", kind: "job", ref: "restock:m1", machine: "m1", by: "a1", before: "", after: "", ticked: [], loadTotal: 0, soldOutAtVisit: false, jobKind: "restock", status: "approved", history: [{ status: "sent", at: "2026-03-05T10:00:00Z" }, { status: "retake", at: "2026-03-05T11:00:00Z" }, { status: "approved", at: "2026-03-06T09:00:00Z" }], sentAt: "2026-03-05T10:00:00Z" }],
  routes: [{ id: "r1", name: "North", runner: "a1", stops: ["m1"], done: [{ machine: "m1", at: "2026-03-07T10:00:00Z" }], createdAt: "t" }],
  claims: [], listings: [],
  sales: [{ machine: "m1", slot: "A1", item: "Chips", sats: 3000, at: "2026-03-08T10:00:00Z", test: false }, { machine: "other", slot: "A1", item: "X", sats: 9, at: "2026-03-08T10:00:00Z", test: false }],
  orders: [], verifies: [{ id: "v", proof: "p1", machine: "m1", npub: "n", at: "2026-03-06T12:00:00Z" }],
  reports: [{ id: "r", machine: "m1", npub: "n", reason: "Empty", text: "t", at: "2026-03-09T10:00:00Z" }], itemRequests: [],
  applicants: [{ id: "a1", name: "Maya", crewName: "maya-g", reach: "", area: "", roles: [], transport: [], hours: "", why: "", stage: "On the crew", notes: [], createdAt: "" }],
});

describe("passportFor", () => {
  it("builds an oldest-first timeline from real records of this machine only", () => {
    const p = passportFor(base(), "m1");
    expect(p.events.map((e) => e.kind)).toEqual(["added", "placed", "proof", "proof", "restock", "verify", "stop", "sale", "report"]);
    expect(p.events[0].kind).toBe("added"); expect(p.events[1].kind).toBe("placed");
    expect(p.events.filter((e) => e.kind === "sale").length).toBe(1);
    expect(p.counts).toEqual({ service: 2, sales: 1, salesSats: 3000, reports: 1, verifies: 1 });
    expect(p.events.find((e) => e.kind === "restock")?.who).toBe("maya-g");
  });
  it("public view drops sales, reports and names", () => {
    const p = passportFor(base(), "m1", { publicView: true });
    expect(p.events.some((e) => e.kind === "sale" || e.kind === "report")).toBe(false);
    expect(p.events.every((e) => e.who === undefined && e.sats === undefined)).toBe(true);
  });
  it("is empty for an unknown machine", () => { expect(passportFor(base(), "nope").events).toEqual([]); });
});
