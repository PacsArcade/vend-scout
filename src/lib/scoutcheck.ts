import { stampString } from "@/components/Bft";
import { readState, type State } from "./store";
import type { ScoutCheck } from "./types";

/** The scout checks with their BFT stamp filled in, ready for scoring. */
export async function checksWithStamps(st?: State): Promise<Record<string, ScoutCheck>> {
  const s = st ?? (await readState());
  const out: Record<string, ScoutCheck> = {};
  for (const [id, c] of Object.entries(s.checks)) out[id] = { ...c, stamp: await stampString(c.at, c.h) };
  return out;
}
