import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { OFF_LINE, SECRET_ENV_NAME, releaseSubname, seatSubname, slugCrewName, validCrewName, handleOf } from "./subname";
import { welcomeText } from "./dm";

const NPUB = nip19.npubEncode(getPublicKey(generateSecretKey()));
const reply = (status: number, reason?: string) => vi.fn(async () => new Response(JSON.stringify(status < 300 ? { ok: true } : { ok: false, reason }), { status })) as unknown as typeof fetch;
const calls = (f: typeof fetch) => ((f as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][]).filter((c) => String(c[0]).includes("/api/registry/subname")); // other calls (block height) are not ours
beforeEach(() => { process.env[SECRET_ENV_NAME] = "shh-test-secret"; vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { delete process.env[SECRET_ENV_NAME]; vi.restoreAllMocks(); });

describe("crew name rules", () => {
  it("slugs what people type into a valid name", () => {
    expect(slugCrewName("Maria G.")).toBe("maria-g"); expect(slugCrewName("  José  ")).toBe("jose"); expect(slugCrewName("--a--")).toBe("a");
    expect(slugCrewName("x".repeat(40)).length).toBe(20); expect(slugCrewName("###")).toBe("");
    expect(validCrewName("maria")).toBe(true); expect(validCrewName("ab")).toBe(false); expect(validCrewName("-maria")).toBe(false); expect(validCrewName("maria-")).toBe(false); expect(validCrewName("a".repeat(21))).toBe(false);
    expect(handleOf("maria")).toBe("maria.vend@frens");
  });
});

describe("the frens subname door", () => {
  it("seats: POST with parent, name, npub and the secret in a header only", async () => {
    const f = reply(200);
    expect(await seatSubname("maria", NPUB, f)).toEqual({ ok: true });
    const [url, init] = calls(f)[0];
    expect(url).toBe("https://frens.earth/api/registry/subname"); expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ parent: "vend", name: "maria", npub: NPUB });
    expect((init.headers as Record<string, string>)["x-frens-subname-secret"]).toBe("shh-test-secret");
    expect(String(init.body)).not.toContain("shh-test-secret");
  });
  it("taken (409) says so and asks for another", async () => {
    const r = await seatSubname("maria", NPUB, reply(409, "already claimed"));
    expect(r).toMatchObject({ ok: false, kind: "taken" }); expect((r as { reason: string }).reason).toContain("Pick another");
  });
  it("releases with DELETE, and a 409 on release means anchored: it stays theirs", async () => {
    const f = reply(200);
    expect(await releaseSubname("maria", f)).toEqual({ ok: true });
    expect(calls(f)[0][1].method).toBe("DELETE"); expect(JSON.parse(String(calls(f)[0][1].body))).toEqual({ parent: "vend", name: "maria" });
    expect(await releaseSubname("maria", reply(409, "anchored"))).toEqual({ ok: false, kind: "anchored", reason: "On-chain, stays theirs" });
  });
  it("a timeout or a dead network gives a plain retry result, never a throw", async () => {
    const t = vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }) as unknown as typeof fetch;
    expect(await seatSubname("maria", NPUB, t)).toMatchObject({ ok: false, kind: "timeout" });
    const d = vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await seatSubname("maria", NPUB, d)).toMatchObject({ ok: false, kind: "error" });
    expect(readTimeout()).toBe(true);
  });
  it("with no env the step is off and no call is made", async () => {
    delete process.env[SECRET_ENV_NAME];
    const f = reply(200);
    expect(await seatSubname("maria", NPUB, f)).toEqual({ ok: false, kind: "off", reason: OFF_LINE });
    expect(OFF_LINE).toBe("Crew names are off (FRENS_SUBNAME_SECRET_VEND not set)");
    expect(calls(f)).toHaveLength(0);
  });
  it("never logs the secret", async () => {
    await seatSubname("maria", NPUB, reply(401, "bad secret"));
    for (const c of (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls) expect(String(c.join(" "))).not.toContain("shh-test-secret");
  });
});
const readTimeout = () => /AbortSignal\.timeout\(TIMEOUT_MS\)/.test(require("fs").readFileSync("src/lib/subname.ts", "utf8")) && /TIMEOUT_MS = 5000/.test(require("fs").readFileSync("src/lib/subname.ts", "utf8"));

describe("on the crew flow", () => {
  const file = path.join(os.tmpdir(), `vend-r17-${process.pid}.json`);
  let perform: typeof import("./store").perform, readState: typeof import("./store").readState;
  const ap = (o: object = {}) => ({ id: "a1", name: "Maria Gomez", reach: "m@x.co", area: "Chicago", roles: ["runner"], transport: [], hours: "", why: "", stage: "Chatted", npub: NPUB, crewName: "maria", notes: [], createdAt: "2026-01-01", ...o });
  const boot = async (a: object) => { await fs.writeFile(file, JSON.stringify({ applicants: [a] })); vi.resetModules(); process.env.VEND_STATE_FILE = file; ({ perform, readState } = await import("./store")); };
  it("moving to On the crew seats the name; the move is kept even when frens is down", async () => {
    await boot(ap());
    vi.stubGlobal("fetch", reply(200));
    expect((await perform({ action: "applicantStep", id: "a1", stage: "On the crew", note: "" })).ok).toBe(true);
    let st = await readState(); expect(st.applicants[0].crewNameState).toMatchObject({ status: "seated", name: "maria" });
    await boot(ap());
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await perform({ action: "applicantStep", id: "a1", stage: "On the crew", note: "" })).ok).toBe(true);
    st = await readState(); expect(st.applicants[0].stage).toBe("On the crew"); expect(st.applicants[0].crewNameState?.status).toBe("failed");
    vi.unstubAllGlobals();
  });
  it("taken shows the reason, and picking another name seats it", async () => {
    await boot(ap());
    vi.stubGlobal("fetch", reply(409, "already claimed"));
    await perform({ action: "applicantStep", id: "a1", stage: "On the crew", note: "" });
    let st = await readState(); expect(st.applicants[0].crewNameState).toMatchObject({ status: "failed" }); expect(st.applicants[0].crewNameState!.reason).toContain("taken");
    vi.stubGlobal("fetch", reply(200));
    expect((await perform({ action: "setCrewName", id: "a1", name: "Maria G" })).ok).toBe(true);
    st = await readState(); expect(st.applicants[0].crewNameState).toMatchObject({ status: "seated", name: "maria-g" });
    vi.unstubAllGlobals();
  });
  it("a bad name is refused and no call is made", async () => {
    await boot(ap({ crewName: undefined }));
    const f = reply(200); vi.stubGlobal("fetch", f);
    expect((await perform({ action: "setCrewName", id: "a1", name: "x" })).ok).toBe(false);
    expect(calls(f)).toHaveLength(0); vi.unstubAllGlobals();
  });
  it("leaving the crew releases; anchored stays theirs; a failed release can be retried", async () => {
    const seated = { status: "seated", name: "maria", at: "2026-01-01" };
    await boot(ap({ stage: "On the crew", crewNameState: seated }));
    vi.stubGlobal("fetch", reply(200));
    await perform({ action: "applicantStep", id: "a1", stage: "Not now", note: "" });
    expect((await readState()).applicants[0].crewNameState?.status).toBe("released");
    await boot(ap({ stage: "On the crew", crewNameState: seated }));
    vi.stubGlobal("fetch", reply(409, "anchored"));
    await perform({ action: "applicantStep", id: "a1", stage: "Not now", note: "" });
    expect((await readState()).applicants[0].crewNameState).toMatchObject({ status: "anchored", reason: "On-chain, stays theirs" });
    await boot(ap({ stage: "On the crew", crewNameState: seated }));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await perform({ action: "applicantStep", id: "a1", stage: "Not now", note: "" });
    expect((await readState()).applicants[0].crewNameState?.status).toBe("seated"); // still seated, retry offered
    vi.stubGlobal("fetch", reply(200));
    expect((await perform({ action: "releaseCrewName", id: "a1" })).ok).toBe(true);
    expect((await readState()).applicants[0].crewNameState?.status).toBe("released");
    vi.unstubAllGlobals();
  });
  it("with no env the move works and nothing is recorded", async () => {
    delete process.env[SECRET_ENV_NAME];
    await boot(ap()); const f = reply(200); vi.stubGlobal("fetch", f);
    expect((await perform({ action: "applicantStep", id: "a1", stage: "On the crew", note: "" })).ok).toBe(true);
    expect(calls(f)).toHaveLength(0); expect((await readState()).applicants[0].crewNameState).toBeUndefined(); vi.unstubAllGlobals();
  });
  it("the apply form pick is slugged and kept; a junk pick is dropped", async () => {
    await fs.writeFile(file, JSON.stringify({})); vi.resetModules(); process.env.VEND_STATE_FILE = file; ({ perform, readState } = await import("./store"));
    await perform({ action: "apply", crewName: "Maria G.", name: "Maria", reach: "m@x.co", area: "Chicago", roles: ["runner"], transport: [] } as never);
    await perform({ action: "apply", crewName: "!", name: "Bo", reach: "b@x.co", area: "Chicago", roles: ["runner"], transport: [] } as never);
    const st = await readState(); expect(st.applicants.map((a) => a.crewName)).toEqual(["maria-g", undefined]);
  });
});

describe("welcome DM and the secret", () => {
  it("mentions the seated name in one short line, no em dash", () => {
    const t = welcomeText({ name: "Maria", url: "https://x/jobs", crewHandle: "maria.vend@frens" });
    expect(t).toContain("Your crew name is maria.vend@frens."); expect(t).not.toContain("—");
    expect(welcomeText({ name: "Maria", url: "https://x/jobs" })).not.toContain("crew name");
  });
  it("the secret name appears only in server files, never in a client component", async () => {
    const { readFileSync } = await import("fs");
    for (const f of ["src/components/ApplyForm.tsx", "src/components/ApplicantsBoard.tsx"]) expect(readFileSync(f, "utf8")).not.toContain("subname\"");
  });
});
