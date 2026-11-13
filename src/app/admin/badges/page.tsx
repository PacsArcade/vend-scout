import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { BadgeSign } from "@/components/BadgeSign";
import { BADGES, anyPlaceholderArt, badgeImageUrl, hasRealArt } from "@/lib/badgedefs";
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
        <p className="intro">Crew badges follow NIP-58. You sign each one with your own nostr signer in this browser. The app never holds a key and never publishes anything until you press a button and sign. It checks the signature, then sends the event to its relay list.</p>
        {anyPlaceholderArt() && <p className="notice bad" role="alert"><b>Placeholder art on seven badges.</b>The VendFrens Crew badge has its real art. The other pictures below are temporary, so do not publish those definitions until their real art is in. A published definition can be replaced later, but wallets may keep showing the old picture for a while.</p>}
        <section className="glass card">
          <h2>Badge definitions</h2>
          <ul className="plain">
            {BADGES.map((b) => {
              const pub = publishedDef(st, b.d);
              return (
                <li key={b.d} className="rowline">
                  <div className={"statecell" + (pub ? "" : " off")}>
                    <span className="art">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={badgeImageUrl(b.d, "")} alt={hasRealArt(b.d) ? `Crew badge art for ${b.name}` : `Placeholder art for ${b.name}`} width={hasRealArt(b.d) ? 52 : 64} height={64} />
                    </span>
                    <div className="sc-text">
                      <b>{b.name}</b><br /><span className="muted small">{b.description}</span><br /><span className="mono small" style={{ overflowWrap: "anywhere" }}>d: {b.d}</span>
                      {pub ? <span className="pubstamp">Published <Bft iso={pub.at} h={pub.h} /></span> : <span className="sr">Not yet published</span>}
                    </div>
                  </div>
                  <div className="rl-act"><BadgeSign d={b.d} origin={origin} label="Sign and publish definition" done={!!pub} /></div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="glass card">
          <h2>Earned awards</h2>
          <p className="intro note">Service milestones count approved stops and jobs, the same count the crew profile shows. On-time streaks count approved stops in a row finished inside the worker&apos;s own block. Publish the definition first.</p>
          {earned.length === 0 ? <p className="muted">No one has earned a badge yet.</p> : (
            <ul className="plain">
              {earned.map((e) => {
                const pub = publishedAward(st, e.badge.d, e.hex);
                return (
                  <li key={`${e.badge.d}:${e.hex}`} className="rowline">
                    <div className={"statecell" + (pub ? "" : " off")}>
                      <span className="art sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={badgeImageUrl(e.badge.d, "")} alt="" width={hasRealArt(e.badge.d) ? 38 : 48} height={48} />
                      </span>
                      <div className="sc-text">
                        <b>{e.name}</b><br /><span>{e.badge.name}{e.value !== undefined ? <span className="muted small"> (now at {e.value})</span> : null}</span>
                        {pub ? <span className="pubstamp">Published <Bft iso={pub.at} h={pub.h} /></span> : <span className="sr">Not yet published</span>}
                      </div>
                    </div>
                    <div className="rl-act">{pub ? <span className="muted small">Done</span> : <BadgeSign d={e.badge.d} origin={origin} recipient={e.hex} label="Sign and publish award" />}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
