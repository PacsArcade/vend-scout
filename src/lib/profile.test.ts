import { describe, expect, it } from "vitest";
import { buildKind0Event, httpsOnly, lud16FromProfile, mergeKind0, nip05Matches, nip05Url, parseKind0, parseNip05, verifyNip05 } from "./profile";

const HEX = "ab".repeat(32);

describe("parseKind0", () => {
  it("reads the eight fields", () => {
    const k = parseKind0(JSON.stringify({ name: "maya", display_name: "Maya G", picture: "https://x.example/p.png", banner: "https://x.example/b.png", about: "hi", nip05: "maya@x.example", lud16: "maya@getalby.com", website: "https://maya.example" }));
    expect(k).toMatchObject({ name: "maya", display_name: "Maya G", picture: "https://x.example/p.png", nip05: "maya@x.example", website: "https://maya.example/" });
  });
  it("refuses non-https images and websites", () => {
    const k = parseKind0(JSON.stringify({ picture: "http://x.example/p.png", banner: "javascript:alert(1)", website: "data:text/html,hi" }));
    expect(k.picture).toBe(""); expect(k.banner).toBe(""); expect(k.website).toBe("");
  });
  it("refuses addresses with credentials or spaces", () => {
    expect(httpsOnly("https://user:pw@x.example/a.png")).toBe("");
    expect(httpsOnly("https://x.example/a b.png")).toBe("");
    expect(httpsOnly("https://localhost/a.png")).toBe("");
  });
  it("caps lengths and drops non-strings", () => {
    const k = parseKind0(JSON.stringify({ name: "x".repeat(500), about: "y".repeat(5000), display_name: 42 }));
    expect(k.name.length).toBe(60); expect(k.about.length).toBe(600); expect(k.display_name).toBe("");
  });
  it("gives empty fields for bad JSON, arrays and null", () => {
    for (const c of ["not json", "[]", "null", "\"s\""]) expect(parseKind0(c).name).toBe("");
  });
  it("strips control characters", () => { expect(parseKind0(JSON.stringify({ name: "a\u0000b\u0007c" })).name).toBe("abc"); });
});

describe("mergeKind0", () => {
  const latest = JSON.stringify({ name: "maya", about: "old", custom_field: { a: 1 }, lud06: "lnurl1x", bot: true });
  it("keeps unknown fields and edits only what changed", () => {
    const out = JSON.parse(mergeKind0(latest, { about: "new" }));
    expect(out).toEqual({ name: "maya", about: "new", custom_field: { a: 1 }, lud06: "lnurl1x", bot: true });
  });
  it("an empty edit removes the field; fields not mentioned stay", () => {
    const out = JSON.parse(mergeKind0(latest, { name: "" }));
    expect("name" in out).toBe(false); expect(out.about).toBe("old");
  });
  it("starts fresh when there is no latest profile or it is garbage", () => {
    expect(JSON.parse(mergeKind0(null, { name: "n" }))).toEqual({ name: "n" });
    expect(JSON.parse(mergeKind0("[1,2]", { name: "n" }))).toEqual({ name: "n" });
  });
  it("drops an unsafe picture instead of writing it", () => {
    expect(JSON.parse(mergeKind0(latest, { picture: "http://x.example/a.png" })).picture).toBeUndefined();
  });
});

describe("buildKind0Event", () => {
  it("is an unsigned kind 0 that keeps tags and moves time forward past the latest", () => {
    const ev = buildKind0Event({ kind: 0, created_at: 2000, tags: [["t", "x"]], content: JSON.stringify({ name: "a", extra: 1 }) }, { about: "b" }, 1000);
    expect(ev.kind).toBe(0); expect(ev.created_at).toBe(2001); expect(ev.tags).toEqual([["t", "x"]]);
    expect(ev).not.toHaveProperty("sig"); expect(ev).not.toHaveProperty("pubkey");
    expect(JSON.parse(ev.content)).toEqual({ name: "a", extra: 1, about: "b" });
  });
  it("works with no latest event", () => { expect(buildKind0Event(null, { name: "n" }, 5)).toMatchObject({ kind: 0, created_at: 5, tags: [] }); });
});

describe("nip05", () => {
  it("parses name@domain and bare domain", () => {
    expect(parseNip05("Maya@Example.com")).toEqual({ name: "maya", domain: "example.com" });
    expect(parseNip05("example.com")).toEqual({ name: "_", domain: "example.com" });
    expect(parseNip05("not an address")).toBeNull();
  });
  it("builds the well-known address", () => { expect(nip05Url({ name: "maya", domain: "example.com" })).toBe("https://example.com/.well-known/nostr.json?name=maya"); });
  it("matches only the right key", () => {
    expect(nip05Matches({ names: { maya: HEX } }, "maya", HEX)).toBe(true);
    expect(nip05Matches({ names: { maya: "cd".repeat(32) } }, "maya", HEX)).toBe(false);
    expect(nip05Matches({}, "maya", HEX)).toBe(false);
    expect(nip05Matches(null, "maya", HEX)).toBe(false);
  });
  it("verifyNip05 answers verified, not verified, unreachable, none", async () => {
    const ok = (async () => new Response(JSON.stringify({ names: { maya: HEX } }))) as unknown as typeof fetch;
    const wrong = (async () => new Response(JSON.stringify({ names: { maya: "cd".repeat(32) } }))) as unknown as typeof fetch;
    const down = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect(await verifyNip05("maya@x.example", HEX, 100, ok)).toBe("verified");
    expect(await verifyNip05("maya@x.example", HEX, 100, wrong)).toBe("not verified");
    expect(await verifyNip05("maya@x.example", HEX, 100, down)).toBe("unreachable");
    expect(await verifyNip05("", HEX)).toBe("none");
  });
});

describe("lud16FromProfile", () => {
  it("still reads a Lightning address", () => { expect(lud16FromProfile(JSON.stringify({ lud16: "maya@getalby.com" }))).toBe("maya@getalby.com"); expect(lud16FromProfile("x")).toBeNull(); });
});
