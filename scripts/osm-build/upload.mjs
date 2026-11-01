// Upload the USA place data from osm-out/ to the Vercel Blob store, under osm/<state>/<kind>.json.gz and osm/usa-index.json.
//   npm run osm:upload              every state
//   npm run osm:upload -- --state texas
//   npm run osm:upload -- --force   re-send files even when unchanged
// Resumable and safe to rerun: osm-out/.uploaded.json remembers the sha1 of each file already sent; unchanged files are skipped.
// usa-index.json goes LAST, so the app never sees a state in the index before its files are there.
// Credentials come from .env.upload (git-ignored). The file is read by NAME; no value is ever printed or logged.
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { put } from "@vercel/blob";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const OUT = path.join(ROOT, "osm-out");
const LEDGER = path.join(OUT, ".uploaded.json");
const args = process.argv.slice(2);
const only = args.includes("--state") ? args[args.indexOf("--state") + 1] : null;
const force = args.includes("--force");
const MAX_AGE = 60 * 60 * 24 * 7; // data changes about daily at most; a week at the edge is fine, the index is re-read often

async function token() {
  const text = await fs.readFile(path.join(ROOT, ".env.upload"), "utf8").catch(() => "");
  const m = text.match(/^\s*BLOB_READ_WRITE_TOKEN\s*=\s*(.*)$/m);
  const v = m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  if (!v) throw new Error("BLOB_READ_WRITE_TOKEN is missing from .env.upload");
  return v;
}
// Never let a token reach a log.
const clean = (e, t) => String(e?.message ?? e).split(t).join("[token]").replace(/vercel_blob_rw_[A-Za-z0-9_]+/g, "[token]").slice(0, 300);

async function main() {
  const tok = await token();
  const ledger = JSON.parse(await fs.readFile(LEDGER, "utf8").catch(() => "{}"));
  const states = (await fs.readdir(OUT, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
  if (only && !states.includes(only)) throw new Error(`no built state "${only}" in osm-out/`);
  let sent = 0, skipped = 0, bytes = 0;
  const t0 = Date.now();
  const send = async (rel, file, type) => {
    const data = await fs.readFile(file);
    const sha = createHash("sha1").update(data).digest("hex");
    if (!force && ledger[rel] === sha) { skipped++; return; }
    for (let i = 1; ; i++) {
      try {
        await put(rel, data, { token: tok, access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: type, cacheControlMaxAge: MAX_AGE });
        break;
      } catch (e) {
        if (i >= 4) throw new Error(`upload failed for ${rel}: ${clean(e, tok)}`);
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
    ledger[rel] = sha; sent++; bytes += data.length;
    await fs.writeFile(LEDGER, JSON.stringify(ledger));
  };
  for (const s of only ? [only] : states) {
    const ts = Date.now();
    const files = (await fs.readdir(path.join(OUT, s))).filter((f) => f.endsWith(".json.gz") || f === "meta.json").sort();
    for (const f of files) await send(`osm/${s}/${f}`, path.join(OUT, s, f), f.endsWith(".gz") ? "application/gzip" : "application/json");
    console.log(`${s}: ${files.length} files, ${((Date.now() - ts) / 1000).toFixed(1)} s`);
  }
  await send("osm/usa-index.json", path.join(OUT, "usa-index.json"), "application/json");
  console.log(`done: sent ${sent}, unchanged ${skipped}, ${(bytes / 1e6).toFixed(2)} MB uploaded, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
main().catch((e) => { console.error(`osm:upload stopped: ${clean(e, "")}`); process.exit(1); });
