import { resolveCrewId } from "@/lib/crewsession";
import Link from "next/link";
import { CrewSwitch } from "@/components/CrewSwitch";
import { PhoneBar } from "@/components/PhoneBar";
import { boardName, levelOf, totalPoints } from "@/lib/arcade";
import { NEVER_SPEED_LINE } from "@/lib/gig";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ crew?: string }> }) {
  const { crew: crewParam } = await searchParams;
  const { id: crew, who } = await resolveCrewId(crewParam);
  const st = await readState();
  const people = st.applicants.filter((a) => a.stage === "On the crew");
  const me = people.find((a) => a.id === crew);
  const city = me?.area ?? "";
  const rows = me ? people.filter((a) => a.leaderboard && a.area.toLowerCase() === city.toLowerCase()).map((a) => ({ id: a.id, name: boardName(a.name), pts: totalPoints(st.proofs, a.id) })).sort((a, b) => b.pts - a.pts) : [];
  return (
    <div className="phonewrap">
      <div className="phone">
        <PhoneBar right="leaderboard" />
        <h1>City leaderboard</h1>
        <CrewSwitch crew={people.map((a) => ({ id: a.id, name: a.name }))} current={me?.id} locked={who.gate && !who.operator} />
        {!me ? <p className="muted">Pick your name.</p> : (
          <>
            <p className="muted small">{city || "Your city"}. Only people who opted in show here, as first name and last initial. Points are for how well you fill. {NEVER_SPEED_LINE}</p>
            {rows.length === 0 ? <div className="glass tile"><b>No one has opted in yet</b><p className="muted small">Turn it on from crew home. It is off until you do.</p></div> : (
              <table className="board"><tbody>
                {rows.map((r, i) => <tr key={r.id}><td className="rank num">{i + 1}</td><td>{r.name}{r.id === me.id ? " (you)" : ""}<br /><span className="muted small">Level {levelOf(r.pts).level}: {levelOf(r.pts).name}</span></td><td className="r num scorecell">{r.pts.toLocaleString("en-US")}</td></tr>)}
              </tbody></table>
            )}
            {!me.leaderboard && <p className="muted small">You are not on the board. It is your choice.</p>}
            <div className="actions"><Link className="btn full" href={`/work?crew=${me.id}`}>Back to crew home</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
