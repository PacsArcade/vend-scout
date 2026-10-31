import { promises as fs } from "fs";
import path from "path";
import { SEED_MACHINES, SEED_NOTES, SEED_ORDERS, SEED_PROSPECTS, SEED_VOTES } from "./seed";
import { osmProspects } from "./overpass";
import { scorePlace } from "./score";
import { tally } from "./vote";
import type { Machine, Note, PickupOrder, Prospect, Stage, VoteOption } from "./types";
import { STAGES } from "./types";

const STATE = path.join(process.cwd(), "data", "state.json");
interface State {
  stages: Record<string, Stage>;
  notes: Record<string, Note[]>;
  ballots: Record<string, { option: string; backed: boolean }[]>;
  suggestions: Record<string, VoteOption[]>;
}
const empty = (): State => ({ stages: {}, notes: {}, ballots: {}, suggestions: {} });

export async function readState(): Promise<State> {
  try {
    return { ...empty(), ...(JSON.parse(await fs.readFile(STATE, "utf8")) as State) };
  } catch {
    return empty();
  }
}
export async function writeState(s: State) {
  await fs.mkdir(path.dirname(STATE), { recursive: true });
  await fs.writeFile(STATE, JSON.stringify(s, null, 1));
}

export type ScoredProspect = Prospect & { score: number };

export async function allProspects(): Promise<ScoredProspect[]> {
  const st = await readState();
  const demo = SEED_PROSPECTS.map((p) => ({ ...p, stage: st.stages[p.id] ?? p.stage, score: scorePlace(p).score }));
  const osm = (await osmProspects(60)).prospects.map((p) => ({ ...p, stage: st.stages[p.id] ?? p.stage }));
  return [...demo, ...osm].sort((a, b) => b.score - a.score);
}

export async function getProspect(id: string) {
  const st = await readState();
  let p: Prospect | undefined = SEED_PROSPECTS.find((x) => x.id === id);
  if (!p) p = (await osmProspects(5000)).prospects.find((x) => x.id === id);
  if (!p) return null;
  const notes = [...(SEED_NOTES[id] ?? []), ...(st.notes[id] ?? [])];
  return { prospect: { ...p, stage: st.stages[id] ?? p.stage }, scored: scorePlace(p), notes };
}

export async function advanceStage(id: string, stage: Stage) {
  if (!STAGES.includes(stage)) throw new Error("bad stage");
  const st = await readState();
  st.stages[id] = stage;
  await writeState(st);
}
export async function addNote(id: string, text: string) {
  const st = await readState();
  const d = new Date();
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  (st.notes[id] ??= []).push({ date, text: text.slice(0, 500) });
  await writeState(st);
}

export const getMachine = (id: string): Machine | undefined => SEED_MACHINES.find((m) => m.id === id);
export const allMachines = () => SEED_MACHINES;
export const getOrder = (code: string): PickupOrder | undefined => SEED_ORDERS.find((o) => o.code === code);

export async function getVotes(machine: string) {
  const st = await readState();
  const options = [...(SEED_VOTES[machine] ?? []), ...(st.suggestions[machine] ?? [])];
  return tally(options, st.ballots[machine] ?? []);
}
export async function castVote(machine: string, option: string, backed: boolean) {
  const st = await readState();
  (st.ballots[machine] ??= []).push({ option, backed });
  await writeState(st);
}
export async function suggest(machine: string, name: string) {
  const st = await readState();
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  (st.suggestions[machine] ??= []).push({ id: "s" + Date.now(), name: clean, votes: 1, sats: 0 });
  await writeState(st);
}
