import { describe, expect, it, beforeAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { CONTRACTOR_NOTE, JOB_MINUTES, PAY_TERMS, ROLE_COPY, SHARED_LINE, satsFor } from "./crew";
import { validLightning } from "./lightning";

let perform: typeof import("./store").perform;
let readState: typeof import("./store").readState;
const file = path.join(os.tmpdir(), `vend-crew-test-${process.pid}.json`);

beforeAll(async () => {
  process.env.VEND_STATE_FILE = file;
  await fs.writeFile(file, JSON.stringify({ machines: [{ id: "m1", name: "M", prospectId: "x", hostName: "H", hostSharePct: 10, placedAt: "2026-01-01", profile: {}, slots: [] }] }));
  ({ perform, readState } = await import("./store"));
});

describe("crew copy", () => {
  it("has the four roles and no em dash or hourly rate", () => {
    const all = [SHARED_LINE, PAY_TERMS.line, ...Object.values(ROLE_COPY).flatMap((r) => [r.title, r.body])].join(" ");
    expect(Object.keys(ROLE_COPY).length).toBe(4);
    expect(all).not.toMatch(/—|W-2|1099|minimum wage|benefits|employee/i);
    expect(PAY_TERMS.line).toBe("Paid in sats.");
    expect(CONTRACTOR_NOTE).toBe("Crew work as independent contractors. Rules differ by place; check yours.");
  });
});
describe("crew flow", () => {
  it("refuses an application with no way to reach the person or no role", async () => {
    expect((await perform({ action: "apply", name: "A", reach: "nope", area: "x", roles: ["runner"], transport: [], hours: "", why: "" })).ok).toBe(false);
    expect((await perform({ action: "apply", name: "A", reach: "a@b.co", area: "x", roles: [], transport: [], hours: "", why: "" })).ok).toBe(false);
  });
  it("takes an application, moves it along with notes, and only an On-the-crew person can run a route", async () => {
    const r = await perform({ action: "apply", name: "Pat", reach: "pat@example.invalid", area: "Pilsen", roles: ["runner"], transport: ["bike"], hours: "", why: "" });
    expect(r.error ?? "ok").toBe("ok");
    const id = r.id!;
    expect((await perform({ action: "createRoute", name: "R", runner: id, stops: ["m1"] })).ok).toBe(false);
    expect((await perform({ action: "applicantStep", id, stage: "On the crew", note: "Ride-along done" })).ok).toBe(true);
    const rt = await perform({ action: "createRoute", name: "R", runner: id, stops: ["m1", "nope"] });
    expect(rt.ok).toBe(true);
    const st = await readState();
    expect(st.applicants[0].notes[0].text).toBe("Ride-along done");
    expect(st.routes[0].stops).toEqual(["m1"]);
  });
  it("a stop is logged only after its proof is approved", async () => {
    const st = await readState();
    const route = st.routes[0].id;
    const sub = { action: "submitProof" as const, kind: "stop" as const, ref: "", route, machine: "m1", before: "r1-1.png", after: "r1-2.png", ticked: [], loadTotal: 0 };
    expect((await perform(sub)).ok).toBe(true);
    expect((await readState()).routes[0].done.length).toBe(0);
    expect((await perform({ ...sub })).ok).toBe(false);
    const pid = (await readState()).proofs[0].id;
    expect((await perform({ action: "reviewProof", id: pid, decision: "approve" })).ok).toBe(true);
    expect((await readState()).routes[0].done.length).toBe(1);
  });
});

describe("pay", () => {
  it("turns $21 an hour into sats per job at the test rate", () => {
    expect(satsFor("restock", 1000)).toBe(7000);
    expect(satsFor("tech", 1000)).toBe(15750);
    expect(JOB_MINUTES.restock).toBe(20);
  });
});
describe("lightning address", () => {
  it("accepts an address and an lnurl", () => {
    expect(validLightning("You@Wallet.Example").value).toBe("you@wallet.example");
    expect(validLightning("lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns").ok).toBe(true);
  });
  it("refuses seed words, keys and junk", () => {
    expect(validLightning("abandon ability able about above absent absorb abstract absurd abuse access accident").ok).toBe(false);
    expect(validLightning("a".repeat(64)).ok).toBe(false);
    expect(validLightning("xprv9s21ZrQH143K").ok).toBe(false);
    expect(validLightning("not an address").ok).toBe(false);
  });
});
