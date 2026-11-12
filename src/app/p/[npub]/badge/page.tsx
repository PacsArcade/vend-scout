import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { NostrFace } from "@/components/NostrProfile";
import { Qr } from "@/components/Qr";
import { readState } from "@/lib/store";
import { keyFromParam, summaryFor } from "@/lib/vendprofile";
import { originFrom } from "@/lib/origin";

export const dynamic = "force-dynamic";

// A crew ID badge: photo and name from the person's own nostr profile, the crew name, the date they joined, and a QR to the public verify page.
export default async function BadgePage({ params }: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await params).npub);
  if (!key) notFound();
  const s = summaryFor(await readState(), key.hex);
  const verifyUrl = `${originFrom(await headers())}/verify/${key.npub}`;
  return (
    <>
      <Nav on="" />
      <main className="page narrow">
        <h1>Crew ID badge</h1>
        {!s.onCrew ? <div className="glass card"><p>This key is not on the crew right now, so there is no badge.</p></div> : (
          <div className="glass card crewid">
            <p className="muted small">frens.earth crew · Vend Scout</p>
            <NostrFace hex={key.hex} size={120} />
            <table style={{ marginTop: 12 }}><tbody>
              <tr><td className="muted small">Crew name</td><td>{s.crewName ? `${s.crewName}.vend@frens` : <span className="muted">Not set</span>}</td></tr>
              <tr><td className="muted small">On the crew since</td><td>{s.since ? <Bft iso={s.since.date} h={s.since.h} /> : <span className="muted">Not recorded</span>}</td></tr>
            </tbody></table>
            <Qr text={verifyUrl} label={`QR code that opens ${verifyUrl}`} size={200} />
            <p className="muted small" style={{ overflowWrap: "anywhere" }}>Scan to check this badge: {verifyUrl}</p>
          </div>
        )}
      </main>
    </>
  );
}
