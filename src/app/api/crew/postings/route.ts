import { NextResponse } from "next/server";
import { CONTRACTOR_NOTE, JOB_NOUN, ROLE_COPY, ROLE_JOB, satsFor } from "@/lib/crew";
import { rateFeed } from "@/lib/rate";
import { scoutPartSats } from "@/lib/scoutpay";
import { CREW_ROLES } from "@/lib/types";
import type { FrensPostingFeed } from "@/lib/frensPosting";

export const dynamic = "force-dynamic";

// Public JSON feed of the crew board, so frens.earth can publish it later.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const rate = await rateFeed.rate();
  const feed: FrensPostingFeed = {
    source: "vend-scout",
    updated: new Date().toISOString(),
    contractorNote: CONTRACTOR_NOTE,
    postings: CREW_ROLES.map((r) => ({
      id: `crew-${r}`, role: r, title: ROLE_COPY[r].title, body: ROLE_COPY[r].body,
      pay: { line: "Paid in sats.", satsPerJob: r === "scout" ? scoutPartSats(rate.satsPerUsd).deal + scoutPartSats(rate.satsPerUsd).placed : satsFor(ROLE_JOB[r], rate.satsPerUsd), job: JOB_NOUN[ROLE_JOB[r]], startingRate: true },
      area: { region: "Illinois", startingIn: "Chicago area" },
      applyUrl: `${origin}/crew/apply?role=${r}`,
    })),
  };
  return NextResponse.json(feed, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
}
