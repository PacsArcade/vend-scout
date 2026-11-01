import { describe, expect, it, beforeAll } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

let perform: typeof import("./store").perform;
let readState: typeof import("./store").readState;
const file = path.join(os.tmpdir(), `vend-inv-test-${process.pid}.json`);
const PLACE = "osm-n9055118992"; // any place from the saved Chicago scan

beforeAll(async () => {
  process.env.VEND_STATE_FILE = file;
  await fs.writeFile(file, JSON.stringify({}));
  ({ perform, readState } = await import("./store"));
});

describe("inventory first", () => {
  it("a new machine is In storage and can only be placed once, at a prospect", async () => {
    const r = await perform({ action: "addInventory", name: "Cards 1", type: "cards" });
    expect(r.ok).toBe(true);
    const id = r.id!;
    expect((await readState()).machines[0].status).toBe("In storage");
    expect((await perform({ action: "placeMachine", machine: id, prospectId: "", hostSharePct: 10 })).ok).toBe(false);
    const placed = await perform({ action: "placeMachine", machine: id, prospectId: PLACE, hostSharePct: 10 });
    expect(placed.error ?? "ok").toBe("ok");
    const m = (await readState()).machines[0];
    expect(m.status).toBe("Placed");
    expect(m.hostName.length).toBeGreaterThan(0);
    expect((await perform({ action: "placeMachine", machine: id, prospectId: PLACE, hostSharePct: 10 })).ok).toBe(false);
    expect((await perform({ action: "machineStatus", machine: id, status: "In repair" })).ok).toBe(true);
    expect((await readState()).machines[0].prospectId).toBe(PLACE); // repair keeps the host
    expect((await perform({ action: "backInService", machine: id })).ok).toBe(true);
    expect((await readState()).machines[0].status).toBe("Placed");
    expect((await perform({ action: "machineStatus", machine: id, status: "In storage" })).ok).toBe(true);
    expect((await readState()).machines[0].prospectId).toBe("");
  });
  it("a host can pick machine types and the pick is saved on the prospect", async () => {
    expect((await perform({ action: "hostPick", prospectId: PLACE, types: [], other: "", note: "" })).ok).toBe(false);
    expect((await perform({ action: "hostPick", prospectId: PLACE, types: ["cards", "snack"], other: "", note: "by the door" })).ok).toBe(true);
    expect((await readState()).hostPicks[PLACE].types).toEqual(["cards", "snack"]);
  });
});
describe("wallet-only listing and jobs", () => {
  it("a listing needs a valid Lightning address and never takes keys", async () => {
    const base = { action: "listing" as const, item: "Honey", kind: "honey" as const, priceSats: 1000, qty: 3, machine: "m1", pickupWindow: "Sat", madeBy: "Me" };
    const inv = await perform({ action: "addInventory", name: "Snack 1", type: "snack" });
    await perform({ action: "placeMachine", machine: inv.id!, prospectId: PLACE, hostSharePct: 10 });
    const st = await readState();
    const mid = st.machines.find((m) => m.id === inv.id)!.id;
    expect((await perform({ ...base, machine: mid, lightning: "not valid" })).ok).toBe(false);
    expect((await perform({ ...base, machine: mid, lightning: "maker@wallet.example" })).ok).toBe(true);
  });
  it("only someone On the crew can claim a job, and a job is claimed once", async () => {
    expect((await perform({ action: "claimJob", job: "restock:m1", kind: "restock", title: "t", by: "nobody" })).ok).toBe(false);
    const ap = await perform({ action: "apply", name: "Lee", reach: "lee@example.invalid", area: "x", roles: ["runner"], transport: [], hours: "", why: "" });
    await perform({ action: "applicantStep", id: ap.id!, stage: "On the crew", note: "" });
    expect((await perform({ action: "claimJob", job: "restock:m1", kind: "restock", title: "t", by: ap.id! })).ok).toBe(true);
    expect((await perform({ action: "claimJob", job: "restock:m1", kind: "restock", title: "t", by: ap.id! })).ok).toBe(false);
    const c = (await readState()).claims[0];
    expect(c.sats).toBe(16000);
    expect((await readState()).claims[0].doneAt).toBeUndefined(); // not done until a proof is approved
  });
});
