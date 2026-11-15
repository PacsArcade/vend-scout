import type { VoteOption } from "./types";

/** r26: what the vote page promises. Soft on purpose: anyone can vote many times, so the votes help us choose, they do not decide. */
export const VOTE_PROMISE = "Top picks help us choose the next restock.";

/** A plain vote counts 1. A sats-backed vote counts 2. */
export const SATS_WEIGHT = 2;

export function weight(opt: Pick<VoteOption, "votes" | "sats">, backedVotes = 0): number {
  return opt.votes + backedVotes * (SATS_WEIGHT - 1);
}

export interface Ballot { option: string; backed: boolean }

export function tally(options: VoteOption[], ballots: Ballot[]): { id: string; name: string; total: number; pct: number }[] {
  const totals = new Map<string, number>(options.map((o) => [o.id, o.votes]));
  for (const b of ballots) totals.set(b.option, (totals.get(b.option) ?? 0) + (b.backed ? SATS_WEIGHT : 1));
  const max = Math.max(1, ...totals.values());
  return options
    .map((o) => ({ id: o.id, name: o.name, total: totals.get(o.id) ?? 0, pct: Math.round(((totals.get(o.id) ?? 0) / max) * 100) }))
    .sort((a, b) => b.total - a.total);
}
