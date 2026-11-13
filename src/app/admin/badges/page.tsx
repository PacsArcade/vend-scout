import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { BadgeSign } from "@/components/BadgeSign";
import { BADGE_ART, BADGES, badgeImageUrl } from "@/lib/badgedefs";
import { earnedBadges, publishedAward, publishedDef } from "@/lib/badges";
import { originFrom } from "@/lib/origin";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const st = await readState();
  const origin = originFrom(await headers());
  const earned = earnedBadges(st);
  return (
    <>
      <Nav on="admin" />
      <main className="page wide-page">
        <h1>Badges</h1>
        <p className="muted measure">Crew badges follow NIP-58. You sign each one with your own nostr signer in this browser. The app never holds a key and never publishes anything until you press a button and sign. It checks the signature, then sends the event to its relay list.</p>
        {BADGE_ART.placeholder && <p className="err measure" role="alert"><b>Placeholder art.</b> No VendFrens artwork exists yet. The pictures below are temporary. Do not publish a definition until the real art is in. A published definition can be replaced later, but wallets may keep showing the old picture for a while.</p>}
        <section className="glass card">
          <h2>Badge definitions</h2>
          <ul className="plain">
            {BADGES.map((b) => {
              const pub = publishedDef(st, b.d);
              return (
                <li key={b.d} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badgeImageUrl(b.d, "")} alt={`Placeholder art for ${b.name}`} width={64} height={64} />
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}><b>{b.name}</b><br /><span className="muted small">{b.description}</span><br /><span className="mono small" style={{ overflowWrap: "anywhere" }}>d: {b.d}</span></div>
                  <div style={{ flex: "1 1 200px" }}>{pub ? <>Published <Bft iso={pub.at} h={pub.h} /></> : <span className="muted">Not yet published</span>}<div style={{ marginTop: 8 }}><BadgeSign d={b.d} origin={origin} label="Sign and publish definition" done={!!pub} /></div></div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="glass card">
          <h2>Earned awards</h2>
          <p className="muted small">Service milestones count approved stops and jobs, the same count the crew profile shows. On-time streaks count approved stops in a row finished inside the worker&apos;s own block. Publish the definition first.</p>
          {earned.length === 0 ? <p className="muted">No one has earned a badge yet.</p> : (
            <div style={{ overflowX: "auto" }}><table><thead><tr><th>Crew</th><th>Badge</th><th>Status</th><th></th></tr></thead><tbody>
              {earned.map((e) => {
                const pub = publishedAward(st, e.badge.d, e.hex);
                return (
                  <tr key={`${e.badge.d}:${e.hex}`}>
                    <td>{e.name}</td>
                    <td>{e.badge.name}{e.value !== undefined ? <span className="muted small"> ({e.value})</span> : null}</td>
                    <td>{pub ? <>Published <Bft iso={pub.at} h={pub.h} /></> : <span className="muted">Not yet published</span>}</td>
                    <td>{pub ? <span className="muted small">Done</span> : <BadgeSign d={e.badge.d} origin={origin} recipient={e.hex} label="Sign and publish award" />}</td>
                  </tr>
                );
              })}
            </tbody></table></div>
          )}
        </section>
      </main>
    </>
  );
}
