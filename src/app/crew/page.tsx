import Link from "next/link";
import { Nav } from "@/components/Nav";
import { CREW_ROLES } from "@/lib/types";
import { CONTRACTOR_NOTE, JOB_NOUN, PAY_TERMS, ROLE_COPY, ROLE_JOB, SHARED_LINE, satsFor } from "@/lib/crew";
import { rateFeed } from "@/lib/rate";
import { scoutPartSats } from "@/lib/scoutpay";

export default async function CrewPage() {
  const rate = await rateFeed.rate();
  const sp = scoutPartSats(rate.satsPerUsd), n = (x: number) => x.toLocaleString("en-US");
  return (
    <>
      <Nav on="crew" />
      <main className="page">
        <div className="crewhead">
          <h1>Join the crew</h1>
          <p className="lead">{SHARED_LINE}</p>
          <p className="muted small">Starting in the Chicago area, open across Illinois.</p>
          <p className="small"><Link className="gl" href="/crew/signin">Already on the crew? Sign in with nostr</Link></p>
        </div>
        <div className="rolecards">
          {CREW_ROLES.map((r) => (
            <section key={r} className="glass card rolecard">
              <h2>{ROLE_COPY[r].title}</h2>
              <p>{ROLE_COPY[r].body}</p>
              <p className="payline">{PAY_TERMS.line} {r === "scout"
                ? <>About half when the deal is set (<span className="num">{n(sp.deal)} sats</span>), half when the machine goes in (<span className="num">{n(sp.placed)} sats</span>), and a bonus of <span className="num">{n(sp.day60)} sats</span> at day 60 if it sells well.</>
                : <>About <span className="num">{n(satsFor(ROLE_JOB[r], rate.satsPerUsd))} sats</span> per {JOB_NOUN[ROLE_JOB[r]]}.</>}</p>
              <div className="actions"><Link className="btn gild" href={`/crew/apply?role=${r}`}>Apply</Link></div>
            </section>
          ))}
        </div>
        <p className="muted small">Pay per job is in sats. These are {rate.label}, and they can change.</p>
        <p className="muted small measure">{CONTRACTOR_NOTE}</p>
        <p className="muted small measure">Not sure which fits? Apply for more than one on the form. We talk first, then ride along on one route together.</p>
      </main>
    </>
  );
}
