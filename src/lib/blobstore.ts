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

export async function readBin(rel: string): Promise<Buffer | null> {
  if (!safe(rel)) return null;
  if (driver() === "file") {
    try { return await fs.readFile(abs(rel)); } catch { return null; }
  }
  try {
    const res = await get(PREFIX + rel, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  } catch { return null; }
}

export async function writeBin(rel: string, data: Buffer | string, contentType = "application/octet-stream"): Promise<void> {
  if (!safe(rel)) throw new Error("bad path");
  if (driver() === "file") {
    await fs.mkdir(path.dirname(abs(rel)), { recursive: true });
    await fs.writeFile(abs(rel), data);
    return;
  }
  await put(PREFIX + rel, data, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType });
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
