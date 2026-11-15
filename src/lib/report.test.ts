import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { deflateSync } from "zlib";
import { cleanPhoto, REPORT_PHOTO_MAX, sniff } from "./reportphoto";
import { emailOk, mailReady, reportReply, sendReportReply } from "./mail";
import { resetLimits } from "./ratelimit";
import { pathIsPublic } from "./operator";

// ---- tiny test pictures, built by hand so the metadata is known ----
const GPS = "GPSLatitude 41.8827 N GPSLongitude 87.6233 W";
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));
function jpeg(): Uint8Array {
  const seg = (m: number, body: Buffer) => { const h = Buffer.alloc(4); h[0] = 0xff; h[1] = m; h.writeUInt16BE(body.length + 2, 2); return Buffer.concat([h, body]); };
  return new Uint8Array(Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "binary")),
    seg(0xe1, Buffer.from(`Exif\0\0${GPS}`, "binary")),
    seg(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>${GPS}</x:xmpmeta>`, "binary")),
    seg(0xfe, Buffer.from(`comment ${GPS}`)),
    seg(0xdb, Buffer.alloc(65, 1)), // a quantisation table: image data, must stay
    Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x11, 0x22, 0x33, 0xff, 0xd9]),
  ]));
}
function png(): Uint8Array {
  const crc = (buf: Buffer) => { let x = 0xffffffff; for (const v of buf) { x ^= v; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; } return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("eXIf", Buffer.from(GPS)), chunk("tEXt", Buffer.from(`Comment\0${GPS}`)), chunk("IDAT", deflateSync(Buffer.alloc(14, 200))), chunk("iTXt", Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${GPS}`)), chunk("IEND", Buffer.alloc(0))]));
}
function webp(): Uint8Array {
  const ck = (type: string, data: Buffer) => { const h = Buffer.alloc(8); h.write(type, 0, "ascii"); h.writeUInt32LE(data.length, 4); return Buffer.concat([h, data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]); };
  const vp8x = Buffer.alloc(10); vp8x[0] = 0x08 | 0x04; // EXIF and XMP flags on
  const body = Buffer.concat([Buffer.from("WEBP"), ck("VP8X", vp8x), ck("VP8L", Buffer.from([0x2f, 1, 2, 3, 4])), ck("EXIF", Buffer.from(GPS)), ck("XMP ", Buffer.from(`<x>${GPS}</x>`))]);
  const head = Buffer.alloc(8); head.write("RIFF", 0, "ascii"); head.writeUInt32LE(body.length, 4);
  return new Uint8Array(Buffer.concat([head, body]));
}

describe("r23 report picture: images only, capped, location data stripped", () => {
  it("knows a picture by its bytes, not its name", () => {
    expect(sniff(jpeg())).toBe("jpg");
    expect(sniff(png())).toBe("png");
    expect(sniff(webp())).toBe("webp");
    expect(sniff(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
  it("cuts EXIF, XMP and comments out of a JPEG and keeps the image data", () => {
    const r = cleanPhoto(jpeg());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(has(r.bytes, "GPSLatitude")).toBe(false);
    expect(has(r.bytes, "Exif")).toBe(false);
    expect(has(r.bytes, "JFIF")).toBe(true);
    expect([...r.bytes.subarray(-5)]).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9]); // the scan data is untouched
    expect(Buffer.from(r.bytes).includes(Buffer.alloc(65, 1))).toBe(true);
    expect(r.bytes[0]).toBe(0xff); expect(r.bytes[1]).toBe(0xd8);
  });
  it("cuts eXIf and text chunks out of a PNG and keeps IHDR, IDAT and IEND", () => {
    const r = cleanPhoto(png());
    expect(r.ok && !has(r.bytes, "GPS") && has(r.bytes, "IDAT") && has(r.bytes, "IEND") && has(r.bytes, "IHDR")).toBe(true);
  });
  it("cuts EXIF and XMP out of a WebP, clears their flags and fixes the size", () => {
    const r = cleanPhoto(webp());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(has(r.bytes, "GPS")).toBe(false);
    expect(Buffer.from(r.bytes).readUInt32LE(4)).toBe(r.bytes.length - 8);
    const at = Buffer.from(r.bytes).indexOf("VP8X");
    expect(r.bytes[at + 8] & 0x0c).toBe(0);
  });
  it("refuses empty, oversized, non-image and broken files", () => {
    expect(cleanPhoto(new Uint8Array(0)).ok).toBe(false);
    const big = new Uint8Array(REPORT_PHOTO_MAX + 1); big.set(jpeg());
    expect(cleanPhoto(big).ok).toBe(false);
    expect(cleanPhoto(new TextEncoder().encode("GIF89a....")).ok).toBe(false);
    expect(cleanPhoto(jpeg().subarray(0, 30)).ok).toBe(false);
  });
});

describe("r23 report email", () => {
  beforeEach(() => { delete process.env.VEND_MAIL_KEY; delete process.env.VEND_MAIL_FROM; });
  it("is off with no keys, so nothing pretends to send", async () => {
    expect(mailReady()).toBe(false);
    let called = false;
    expect(await sendReportReply("a@example.com", "M", "https://x/m/m1", (async () => { called = true; return new Response("{}"); }) as typeof fetch)).toBe(false);
    expect(called).toBe(false);
  });
  it("sends one plain note when set up, with how to sign up, and says the address is dropped", async () => {
    process.env.VEND_MAIL_KEY = "test-key"; process.env.VEND_MAIL_FROM = "VendFrens <hello@example.com>";
    const calls: { url: string; body: { to: string[]; subject: string; text: string } }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    expect(await sendReportReply("pat@example.com", "TEST Machine 01", "https://x/m/m1", f)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].body.to).toEqual(["pat@example.com"]);
    expect(calls[0].body.text).toContain("https://x/m/m1");
    expect(calls[0].body.text).toMatch(/not on any list/);
    expect(await sendReportReply("not an email", "M", "u", f)).toBe(false);
  });
  it("copy laws: fren not friend, no em dash", () => {
    const { subject, text } = reportReply("M", "u");
    expect(subject + text).not.toMatch(/—|friend/i);
    expect(text).toMatch(/\bfren\b/);
    expect(emailOk("a@b.co")).toBe(true);
    expect(emailOk("a@b")).toBe(false);
    expect(emailOk("<a@b.co>")).toBe(false);
  });
});

// ---- the store action and the public route, against a temp state file ----
let perform: typeof import("./store").perform;
let readState: typeof import("./store").readState;
let POST: typeof import("../app/api/m/[machine]/report/route").POST;
const file = path.join(os.tmpdir(), `vend-r23-report-${process.pid}.json`);
const made: string[] = [];
beforeAll(async () => {
  process.env.VEND_STATE_FILE = file;
  await fs.writeFile(file, JSON.stringify({ machines: [
    { id: "m1", name: "M1", status: "Placed", prospectId: "x", hostName: "H", hostSharePct: 10, placedAt: "2026-01-01", profile: {}, slots: [] },
    { id: "m9", name: "Stored", status: "In storage", prospectId: "", hostName: "", hostSharePct: 0, placedAt: "", profile: {}, slots: [] },
  ] }));
  ({ perform, readState } = await import("./store"));
  ({ POST } = await import("../app/api/m/[machine]/report/route"));
});
afterAll(async () => {
  await fs.rm(file, { force: true });
  for (const f of made) await fs.rm(path.join(process.cwd(), "data", "reports", f), { force: true });
});

describe("r23 public report: store rules", () => {
  it("needs a known reason, a few words and a cleaned picture name, on a placed machine", async () => {
    const ok = { action: "publicReport" as const, machine: "m1", reason: "The machine is broken", text: "Took my coins", photo: "rp-1-0123abcd.jpg" };
    expect((await perform({ ...ok, reason: "made up" })).ok).toBe(false);
    expect((await perform({ ...ok, text: "x" })).ok).toBe(false);
    expect((await perform({ ...ok, photo: "../state.json" })).ok).toBe(false);
    expect((await perform({ ...ok, machine: "m9" })).ok).toBe(false);
    expect((await perform(ok)).ok).toBe(true);
    const r = (await readState()).reports.at(-1)!;
    expect(r).toMatchObject({ machine: "m1", npub: "", photo: "rp-1-0123abcd.jpg", text: "Took my coins" });
    expect(JSON.stringify(r)).not.toMatch(/@/); // no email is ever kept
  });
});

describe("r23 public report: the route", () => {
  beforeEach(() => { resetLimits(); delete process.env.VEND_MAIL_KEY; delete process.env.VEND_MAIL_FROM; });
  const send = (fields: Record<string, string | Blob>, ip = "203.0.113.7", machine = "m1") => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return POST(new Request(`http://localhost/api/m/${machine}/report`, { method: "POST", body: fd, headers: { "x-forwarded-for": ip } }), { params: Promise.resolve({ machine }) });
  };
  const pic = () => new Blob([Buffer.from(jpeg())], { type: "image/jpeg" });
  it("is public, with no sign-in", () => { expect(pathIsPublic("/api/m/m1/report", true)).toBe(true); expect(pathIsPublic("/api/reportphoto/rp-1-0123abcd.jpg", true)).toBe(false); });
  it("needs a picture and a comment", async () => {
    expect((await send({ reason: "The machine is broken", text: "Took my coins" })).status).toBe(400);
    expect((await send({ reason: "The machine is broken", text: "", photo: pic() })).status).toBe(400);
    expect((await send({ reason: "The machine is broken", text: "Took my coins", photo: new Blob(["<svg/>"], { type: "image/jpeg" }) })).status).toBe(400);
  });
  it("stores the picture with no location data and says thank you", async () => {
    const res = await send({ reason: "The machine is broken", text: "B4 ate my dollar", photo: pic() });
    const j = await res.json();
    expect(j.ok).toBe(true);
    const r = (await readState()).reports.at(-1)!;
    made.push(r.photo!);
    const saved = await fs.readFile(path.join(process.cwd(), "data", "reports", r.photo!));
    expect(saved.includes(Buffer.from("GPSLatitude"))).toBe(false);
  });
  it("refuses an email when mail is not set up, rather than pretend", async () => {
    const res = await send({ reason: "The machine is broken", text: "B4 ate my dollar", photo: pic(), email: "pat@example.com" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not set up/);
  });
  it("limits how often one phone can send", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) { const res = await send({ reason: "The machine is empty", text: "Nothing left", photo: pic() }, "198.51.100.4"); codes.push(res.status); if (res.ok) made.push((await readState()).reports.at(-1)!.photo!); }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(2);
    expect((await send({ reason: "The machine is empty", text: "Nothing left", photo: pic() }, "198.51.100.5")).status).not.toBe(429);
    made.push((await readState()).reports.at(-1)!.photo!);
  });
  it("saves nothing when the honeypot is filled", async () => {
    const before = (await readState()).reports.length;
    expect((await (await send({ reason: "The machine is empty", text: "Nothing left", photo: pic(), hp: "spam" }, "192.0.2.1")).json()).ok).toBe(true);
    expect((await readState()).reports.length).toBe(before);
  });
});
