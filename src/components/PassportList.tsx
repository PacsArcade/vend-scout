import { Bft } from "./Bft";
import type { PassportEvent } from "@/lib/passport";
import { sats } from "@/lib/format";

/** The machine passport as a plain list, newest first. Operators see sales and who did the work. */
export function PassportList({ events }: { events: PassportEvent[] }) {
  if (events.length === 0) return <p className="muted">Nothing on record yet.</p>;
  return (
    <ul className="plain passport">
      {[...events].reverse().slice(0, 60).map((e, i) => (
        <li key={`${e.at}-${i}`}><Bft iso={e.at} h={e.h} /> {e.text}{e.who ? <span className="muted small"> by {e.who}</span> : null}{e.sats ? <span className="muted small"> {sats(e.sats)}</span> : null}</li>
      ))}
    </ul>
  );
}
