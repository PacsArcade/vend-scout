import { Bft } from "./Bft";
import type { PassportEvent } from "@/lib/passport";
import { nextMilestone, visitStamps, VISIT_MILESTONES } from "@/lib/stamps";

const Icon = ({ tech }: { tech: boolean }) => tech
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.4-.6-.6-2.4z" /></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M3 7l9 5 9-5M12 12v10" /></svg>;
const TIER = { bronze: "Bronze streak", silver: "Silver streak", gold: "Gold streak" };

/** The machine passport as numbered visit stamps. Newest visits last, a page of 12, then waiting stamps to finish the row.
 * Milestone stamps (visit 1, 21, 100) are gold with the words. Streak tiers (bronze, silver, gold) show only when a visit is known to be on time. */
export async function PassportStamps({ events, page = 12, cols = 4 }: { events: PassportEvent[]; page?: number; cols?: number }) {
  const all = visitStamps(events);
  const shown = all.slice(-page);
  const fill = shown.length === 0 ? 0 : (cols - (shown.length % cols)) % cols;
  const next = all.length + 1;
  const nm = nextMilestone(all.length);
  return (
    <>
      <ul className="vstamps" aria-label="Service visit stamps">
        {shown.map((v) => (
          <li key={v.n} className={"vstamp" + (v.milestone ? " mile" : "") + (v.tier ? ` tier-${v.tier}` : "")}>
            <span className="no">Visit {v.n}</span>
            <span className="kd"><Icon tech={/tech/i.test(v.event.text)} />{/tech/i.test(v.event.text) ? "Repair" : "Restock"}</span>
            {v.event.who ? <span className="by">{v.event.who}</span> : null}
            <span className="bl"><Bft iso={v.event.at} h={v.event.h} /></span>
            <span className={"mk" + (v.onTime === false ? " late" : "")}>{v.milestone ? `Milestone: ${v.n} visit${v.n === 1 ? "" : "s"}` : v.tier ? TIER[v.tier] : v.onTime === true ? "On time" : v.onTime === false ? "Late" : "Approved"}</span>
          </li>
        ))}
        {Array.from({ length: fill }, (_, i) => (
          <li key={`w${i}`} className="vstamp wait">
            <span className="no">Visit {next + i}</span>
            <span className="kd">Waiting</span>
            <span className="bl">Next service</span>
            <span className="bl">No block yet</span>
            <span className="mk">{VISIT_MILESTONES.includes(next + i) ? `Milestone: ${next + i} visits` : "Still open"}</span>
          </li>
        ))}
      </ul>
      {all.length === 0 && <p className="muted">No service visit on record yet. The first approved restock gets stamp 1, a gold milestone.</p>}
      {all.length > 0 && nm && <p className="dim small">Next gold stamp: visit {nm}. Streaks (bronze after 3 on-time visits in a row, silver after 7, gold after 21) show once a job carries a due block.</p>}
    </>
  );
}
