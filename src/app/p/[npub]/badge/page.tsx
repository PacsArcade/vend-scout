import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { NostrFace } from "@/components/NostrProfile";
import { Qr } from "@/components/Qr";
import { badgeImageUrl, hasRealArt } from "@/lib/badgedefs";
import { earnedFor, publishedAward } from "@/lib/badges";
import { readState } from "@/lib/store";
import { keyFromParam, summaryFor } from "@/lib/vendprofile";
import { originFrom } from "@/lib/origin";

export const dynamic = "force-dynamic";

// A crew ID badge: photo and name from the person's own nostr profile, the crew name, the date they joined, and a QR to the public verify page.
export default async function BadgePage({ params }: { params: Promise<{ npub: string }> }) {
  const key = keyFromParam((await params).npub);
  if (!key) notFound();
  const st = await readState();
  const s = summaryFor(st, key.hex);
  const earned = s.onCrew ? earnedFor(st, key.hex) : [];
  const verifyUrl = `${originFrom(await headers())}/verify/${key.npub}`;
  return (
    <>
      <Nav on="" />
      <main className="page narrow pagecenter">
        <h1>Crew ID badge</h1>
        {!s.onCrew ? <div className="glass card"><p>This key is not on the crew right now, so there is no badge.</p></div> : (
          <div className="glass card crewid">
            <div className="crewhead2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="crewcard-art" src="/brand/05-crew-badge-full.svg" alt="VendFrens crew badge" width={67} height={84} />
              <p className="muted small">VendFrens crew</p>
            </div>
            <NostrFace hex={key.hex} size={120} />
            <table className="kv" style={{ marginTop: 12 }}><tbody>
              <tr><td className="muted small">Crew name</td><td>{s.crewName ? `${s.crewName}.vend@frens` : <span className="muted">Not set</span>}</td></tr>
              <tr><td className="muted small">On the crew since</td><td>{s.since ? <Bft iso={s.since.date} h={s.since.h} /> : <span className="muted">Not recorded</span>}</td></tr>
            </tbody></table>
            <div className="scanarea"><Qr text={verifyUrl} label={`QR code that opens ${verifyUrl}`} size={200} /></div>
            <p className="muted small scancap">Scan to check this badge: {verifyUrl}</p>
          </div>
        )}
        {earned.length > 0 && (
          <section className="glass card" aria-label="Earned badges">
            <h2>Earned badges</h2>
            {earned.some((e) => !hasRealArt(e.badge.d)) && <p className="intro note">The crew badge has its real art. The other badge pictures are placeholders and the real ones are coming.</p>}
            <ul className="plain">
              {earned.map((e) => {
                const pub = publishedAward(st, e.badge.d, e.hex);
                return (
                  <li key={e.badge.d} style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <span style={{ width: 48, display: "flex", justifyContent: "center", flex: "none" }}><img src={badgeImageUrl(e.badge.d, "")} alt="" width={hasRealArt(e.badge.d) ? 38 : 48} height={48} style={{ imageRendering: "pixelated" }} /></span>
                    <span><b>{e.badge.name}</b><br /><span className="muted small">{pub ? "Published" : "Not yet published"}</span></span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
