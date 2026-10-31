// Storage adapter. Two drivers, one interface.
//  - file: under ./data (dev and tests). Used when VEND_STATE_FILE is set, or when there is no blob token.
//  - Vercel Blob: used when BLOB_READ_WRITE_TOKEN is present and VEND_STATE_FILE is not.
// Pattern copied from frens.earth (src/lib/registry.ts, private-store.ts), not imported.
// Everything here is PRIVATE in Blob (access: "private"): the state holds applicants, contacts and proofs.
// Last write wins. That is accepted for a single operator and a small crew. See DEPLOY.md.
import { promises as fs } from "fs";
import path from "path";
import { get, put } from "@vercel/blob";

const ROOT = path.join(process.cwd(), "data");
const PREFIX = "vend/";

export const driver = (): "file" | "blob" => (process.env.BLOB_READ_WRITE_TOKEN && !process.env.VEND_STATE_FILE ? "blob" : "file");
const safe = (rel: string) => rel.split("/").every((p) => /^[\w.@-]+$/.test(p) && p !== "..") && rel.length < 200;
const abs = (rel: string) => path.join(ROOT, rel);

/** A short, safe description of an error for the logs and the operator. Never includes a token. */
export function errText(e: unknown): string {
  const x = e as { name?: string; message?: string };
  return `${x?.name ?? "Error"}: ${String(x?.message ?? e).replace(/vercel_blob_rw_[A-Za-z0-9_]+/g, "[token]").slice(0, 300)}`;
}

export async function readBin(rel: string): Promise<Buffer | null> {
  if (!safe(rel)) { console.error(`[vend-store] read refused rel=${rel} reason=unsafe path`); return null; }
  if (driver() === "file") {
    try { return await fs.readFile(abs(rel)); } catch (e) { if ((e as { code?: string }).code !== "ENOENT") console.error(`[vend-store] read failed rel=${rel} driver=file ${errText(e)}`); return null; }
  }
  try {
    // useCache false: these files are overwritten in place (state, scan caches). The CDN copy can be stale
    // or a cached "not found" from before the first write, so always read from origin.
    let res = null as Awaited<ReturnType<typeof get>>;
    try { res = await get(PREFIX + rel, { access: "private", useCache: false }); }
    catch (e) {
      // The origin read failed with an error (not a plain not-found). Say so, then try the normal read once so a bad edge case cannot hide saved data.
      console.error(`[vend-store] origin read failed rel=${rel} driver=blob ${errText(e)}; retrying with the cache`);
      res = await get(PREFIX + rel, { access: "private" });
    }
    if (!res) { console.info(`[vend-store] read miss rel=${rel} driver=blob (not found)`); return null; }
    if (res.statusCode !== 200) { console.error(`[vend-store] read rel=${rel} driver=blob unexpected status ${res.statusCode}`); return null; }
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  } catch (e) { console.error(`[vend-store] read failed rel=${rel} driver=blob ${errText(e)}`); return null; }
}

/** Writes THROW on failure (after logging) so a caller can never believe a lost write succeeded. */
export async function writeBin(rel: string, data: Buffer | string, contentType = "application/octet-stream"): Promise<void> {
  if (!safe(rel)) { console.error(`[vend-store] write refused rel=${rel} reason=unsafe path`); throw new Error("bad path"); }
  try {
    if (driver() === "file") {
      await fs.mkdir(path.dirname(abs(rel)), { recursive: true });
      await fs.writeFile(abs(rel), data);
      return;
    }
    await put(PREFIX + rel, data, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 60 });
  } catch (e) {
    console.error(`[vend-store] write failed rel=${rel} driver=${driver()} ${errText(e)}`);
    throw e;
  }
}

/** Write a file, read it straight back, and say what happened. For the operator's "storage check". Never throws. */
export async function storageProbe(): Promise<{ driver: string; wrote: boolean; read: boolean; match: boolean; error?: string }> {
  const rel = "cache/probe.json", body = JSON.stringify({ at: Date.now() });
  const out = { driver: driver(), wrote: false, read: false, match: false } as { driver: string; wrote: boolean; read: boolean; match: boolean; error?: string };
  try { await writeBin(rel, body, "application/json"); out.wrote = true; } catch (e) { out.error = `write: ${errText(e)}`; return out; }
  const back = await readText(rel);
  out.read = back !== null; out.match = back === body;
  if (!out.read) out.error = "The file was written but reading it back found nothing. See the [vend-store] lines in the runtime logs.";
  else if (!out.match) out.error = "The file read back is different (a stale copy).";
  return out;
}

export async function readText(rel: string): Promise<string | null> {
  const b = await readBin(rel);
  return b ? b.toString("utf8") : null;
}
export const writeText = (rel: string, text: string) => writeBin(rel, text, "application/json");

/** The state document. The file driver honours VEND_STATE_FILE (any path). */
export async function readStateText(): Promise<string | null> {
  if (driver() === "file") {
    try { return await fs.readFile(process.env.VEND_STATE_FILE || abs("state.json"), "utf8"); } catch { return null; }
  }
  return readText("state.json");
}
export async function writeStateText(text: string): Promise<void> {
  if (driver() === "file") {
    const f = process.env.VEND_STATE_FILE || abs("state.json");
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, text);
    return;
  }
  await writeText("state.json", text);
}
