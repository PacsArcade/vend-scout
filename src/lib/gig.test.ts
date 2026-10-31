import { describe, expect, it } from "vitest";
import { offersFor, priorityFor, zonesOf } from "./offers";
import { GIG } from "./gig";
import { ILLINOIS, cityCenter } from "./places";
import type { Job } from "./jobs";
import type { State } from "./store";

const base = (): State => ({ tracked: {}, notes: {}, packages: {}, outreach: {}, hostPicks: {}, online: {}, passes: {}, seen: {}, blocks: [], payouts: [], proofs: [], items: [], aiLog: [], checks: {}, scoutAwards: [], credits: {}, creditLog: [], verifies: [], reports: [], itemRequests: [], dms: [], machines: [], sales: [], orders: [], listings: [], ballots: {}, suggestions: {}, applicants: [], routes: [], claims: [], counter: 0 });
const job = (id: string, lat: number, lon: number, bonus = 0): Job => ({ id, kind: "restock", title: id, detail: "", sats: 7000, bonus, lat, lon });
const crew = (id: string, lat: number, lon: number) => ({ id, name: id, reach: "", area: "x", lat, lon, roles: ["runner" as const], transport: [], hours: "", why: "", stage: "On the crew" as const, notes: [], createdAt: "2026-01-01" });
const centers = Object.fromEntries(ILLINOIS.map((c) => [c.slug, cityCenter(c)]));
const NOW = 1_000_000_000_000;

describe("offers", () => {
  it("shows pay up front and includes the busy bonus in the total", () => {
    const st = base(); st.applicants.push(crew("a", 41.88, -87.65));
    const o = offersFor(st, [job("j1", 41.88, -87.65, GIG.busyBonusSats)], "a", null, NOW, centers);
    expect(o[0].base).toBe(7000);
    expect(o[0].total).toBe(7000 + GIG.busyBonusSats);
  });
  it("passing hides the offer for that worker only and costs nothing", () => {
    const st = base(); st.applicants.push(crew("a", 41.88, -87.65), crew("b", 41.88, -87.65)); st.passes.a = ["j1"];
    expect(offersFor(st, [job("j1", 41.88, -87.65)], "a", null, NOW, centers).length).toBe(0);
    expect(offersFor(st, [job("j1", 41.88, -87.65)], "b", null, NOW, centers).length).toBe(1);
  });
  it("new workers get first look near them, then everyone sees it", () => {
    const st = base(); st.applicants.push(crew("new", 41.88, -87.65), crew("vet", 41.9, -87.7)); st.online.new = true;
    for (let i = 0; i < GIG.welcomeJobs; i++) st.claims.push({ job: "old" + i, kind: "restock", title: "", sats: 1, by: "vet", at: "", doneAt: "x" });
    st.seen.j1 = NOW - 30_000;
    const j = job("j1", 41.881, -87.651);
    expect(priorityFor(st, j, NOW, centers).get("new")).toBe("welcome");
    expect(offersFor(st, [j], "vet", null, NOW, centers).length).toBe(0);
    expect(offersFor(st, [j], "new", null, NOW, centers)[0].tag).toBe("welcome");
    expect(offersFor(st, [j], "vet", null, NOW + GIG.firstLookMs + 1, centers).length).toBe(1);
  });
  it("an active scheduled block in the city gets first look", () => {
    const st = base(); st.applicants.push(crew("a", 41.88, -87.65), crew("b", 41.88, -87.65));
    st.blocks.push({ id: "b1", by: "a", city: "chicago", cityName: "Chicago", startAt: new Date(NOW - 3600_000).toISOString(), endAt: new Date(NOW + 3600_000).toISOString() });
    st.seen.j1 = NOW - 1000;
    expect(offersFor(st, [job("j1", 41.9, -87.65)], "b", null, NOW, centers).length).toBe(0);
    expect(offersFor(st, [job("j1", 41.9, -87.65)], "a", null, NOW, centers)[0].tag).toBe("block");
  });
  it("busy zones count open jobs per area", () => {
    const z = zonesOf([job("a", 41.88, -87.65), job("b", 41.881, -87.651), job("c", 42.5, -88.9)]);
    expect(z.map((x) => x.count).sort()).toEqual([1, 2]);
  });
});
describe("Illinois", () => {
  it("lists Chicago first and the eight next cities", () => {
    expect(ILLINOIS[0].slug).toBe("chicago");
    expect(ILLINOIS.map((c) => c.name.split(",")[0])).toEqual(expect.arrayContaining(["Aurora", "Naperville", "Joliet", "Rockford", "Springfield", "Peoria", "Elgin", "Champaign"]));
  });
});
