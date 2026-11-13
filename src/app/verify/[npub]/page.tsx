import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Bft, NowStamp } from "@/components/Bft";
import { NostrFace } from "@/components/NostrProfile";
import { currentHeight } from "@/lib/time";
import { readState } from "@/lib/store";
import { VerifyLive } from "@/components/VerifyLive";
import { keyFromParam, summaryFor } from "@/lib/vendprofile";
import { viewFor } from "@/lib/verifycode";
import { nowMs } from "@/lib/clock";
import { nip19 } from "nostr-tools";

export const dynamic = "force-dynamic";

// Public. Answers one question from live server data: is this key On the crew of frens.earth right now?
export default async function VerifyPage({ params }: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await params).npub);
  if (!key) notFound();
  const st = await readState();
  const s = summaryFor(st, key.hex);
  const now = await currentHeight();
  const view = viewFor(key.hex, s.onCrew, st.verifySigs?.[key.hex], nowMs(), (h) => nip19.npubEncode(h));
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
          <p className="muted small" style={{ marginTop: 12 }}>Checked at <NowStamp />{now.live ? "" : " (last known, the time service did not answer)"}.</p>
          <p className="mono small" style={{ overflowWrap: "anywhere" }}>{key.npub}</p>
        </div>
        {s.onCrew && <VerifyLive hex={key.hex} npub={key.npub} initial={view} />}
      </main>
    </>
  );
}
