import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { Empty } from "@/components/Shell";
import { AUTO_APPROVE, MODEL } from "@/lib/autoCheck";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AiCheckPage() {
  const st = await readState();
  const log = st.aiLog;
  const agree = log.filter((l) => l.agree).length;
  const dis = log.filter((l) => !l.agree);
  const pct = log.length ? Math.round((agree / log.length) * 100) : 0;
  const waiting = st.proofs.filter((p) => p.status === "sent").length;
  const errors = st.proofs.filter((p) => p.ai?.error).length;
  return (
    <>
      <Nav on="admin" />
      <main className="page">
        <h1>AI check, shadow mode</h1>
        <p className="muted measure">The checker ({MODEL}, on this box) looks at each proof and suggests. A person still approves and pays. This page compares its call with the person&apos;s final decision. Auto-approve is {AUTO_APPROVE ? "on" : "off"}; turning it on is the Admiral&apos;s ruling.</p>
        <div className="strip">
          <div className="glass kpi"><span className="muted">Checked and decided</span><div className="v num">{log.length}</div></div>
          <div className="glass kpi"><span className="muted">Agreement</span><div className="v num">{log.length ? `${pct}%` : "none yet"}</div></div>
          <div className="glass kpi"><span className="muted">Disagreed</span><div className="v num">{dis.length}</div></div>
          <div className="glass kpi"><span className="muted">Waiting for a person</span><div className="v num">{waiting}</div></div>
        </div>
        {log.length === 0 ? <Empty title="No decisions logged yet"><p className="muted">Each time a person approves or asks for a retake on a proof the checker looked at, it is logged here with the checker&apos;s call.</p></Empty> : (
          <div className="glass card">
            <h2>Where they disagreed</h2>
            {dis.length === 0 ? <p className="muted">No disagreements so far.</p> : (
              <table><tbody>
                {await Promise.all(dis.map(async (d, i) => (
                  <tr key={i}><td>{d.title}<br /><span className="muted small">AI: {d.aiOverall === "pass" ? "looks good" : "needs a person"}. Person: {d.humanDecision === "approve" ? "approved" : "retake"}.</span><br /><span className="muted small"><Bft iso={d.at} h={d.h} /></span></td>
                    <td className="r"><a className="chip" href={`/api/stopphoto/${d.before}`} target="_blank" rel="noopener noreferrer">Before</a><a className="chip" href={`/api/stopphoto/${d.after}`} target="_blank" rel="noopener noreferrer">After</a></td></tr>
                )))}
              </tbody></table>
            )}
          </div>
        )}
        {errors > 0 && <p className="muted small">{errors} proof{errors === 1 ? "" : "s"} could not be checked by the model (it was down, slow or answered badly), so they went to a person.</p>}
        <Link className="btn" href="/admin">Back to admin</Link>
      </main>
    </>
  );
}
