import Link from "next/link";
import { Nav } from "@/components/Nav";
import { CREW_ROLES } from "@/lib/types";
import { CONTRACTOR_NOTE, JOB_NOUN, PAY_TERMS, ROLE_COPY, ROLE_JOB, SHARED_LINE, satsFor } from "@/lib/crew";
import { rateFeed } from "@/lib/rate";

export default async function CrewPage() {
  const rate = await rateFeed.rate();
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
              <p className="payline">{PAY_TERMS.line} About <span className="num">{satsFor(ROLE_JOB[r], rate.satsPerUsd).toLocaleString("en-US")} sats</span> per {JOB_NOUN[ROLE_JOB[r]]}{r === "scout" ? ", and the same again at day 60 if the machine sells well" : ""}.</p>
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
