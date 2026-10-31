import { promises as fs } from "fs";
import path from "path";

const URL_ = "https://time.pacsarcade.org/height";
const FILE = path.join(process.cwd(), "data", "cache", "height.json");
let mem: { h: number; at: number } | null = null;

export interface Height { h: number; live: boolean; at: number }

/** Block height from the house time service. Cached a minute. If it fails, the last known height is returned with live=false. */
export async function currentHeight(): Promise<Height> {
  if (mem && Date.now() - mem.at < 60_000) return { h: mem.h, live: true, at: mem.at };
  try {
    const r = await fetch(URL_, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const j = (await r.json()) as { height: number };
    if (!r.ok || !Number.isFinite(j.height)) throw new Error("bad height");
    mem = { h: j.height, at: Date.now() };
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(mem));
    return { h: j.height, live: true, at: mem.at };
  } catch {
    try {
      const last = JSON.parse(await fs.readFile(FILE, "utf8")) as { h: number; at: number };
      return { h: last.h, live: false, at: last.at };
    } catch {
      return { h: 0, live: false, at: 0 };
    }
  }
}
