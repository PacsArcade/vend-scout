import { NextResponse } from "next/server";
import { castVote, getVotes, suggest } from "@/lib/store";

export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get("machine") ?? "m01";
  return NextResponse.json(await getVotes(m));
}
export async function POST(req: Request) {
  const b = (await req.json()) as { machine: string; option?: string; backed?: boolean; suggest?: string };
  if (b.suggest) await suggest(b.machine, b.suggest);
  if (b.option) await castVote(b.machine, b.option, !!b.backed);
  return NextResponse.json(await getVotes(b.machine));
}
