import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Bft, NowStamp } from "@/components/Bft";
import { NostrFace } from "@/components/NostrProfile";
import { currentHeight } from "@/lib/time";
import { readState } from "@/lib/store";
import { keyFromParam, summaryFor } from "@/lib/vendprofile";

export const dynamic = "force-dynamic";

// Public. Answers one question from live server data: is this key On the crew of frens.earth right now?
export default async function VerifyPage({ params }: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await params).npub);
  if (!key) notFound();
  const s = summaryFor(await readState(), key.hex);
  const now = await currentHeight();
  return (
    <>
      <Nav on="" />
      <main className="page narrow">
        <h1>Crew check</h1>
        <div className="glass card" role="status">
          <h2>{s.onCrew ? "Yes, on the crew" : "Not on the crew"}</h2>
          <p>{s.onCrew ? "This key is On the crew of frens.earth right now." : "This key is not On the crew of frens.earth right now."}</p>
          {s.onCrew && <table><tbody>
            <tr><td className="muted small">Crew name</td><td>{s.crewName ? `${s.crewName}.vend@frens` : <span className="muted">Not set</span>}</td></tr>
            <tr><td className="muted small">On the crew since</td><td>{s.since ? <Bft iso={s.since.date} h={s.since.h} /> : <span className="muted">Not recorded</span>}</td></tr>
          </tbody></table>}
          {s.onCrew && <NostrFace hex={key.hex} size={64} />}
          <p className="muted small" style={{ marginTop: 12 }}>Checked at block <span className="num">{now.h ? now.h.toLocaleString("en-US") : "unknown"}</span>{now.live ? "" : " (last known, the time service did not answer)"}. <NowStamp /></p>
          <p className="mono small" style={{ overflowWrap: "anywhere" }}>{key.npub}</p>
        </div>
      </main>
    </>
  );
}
