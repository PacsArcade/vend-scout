import { Nav } from "@/components/Nav";
import { CrewSignIn, DmDemo } from "@/components/CrewSignIn";

export const dynamic = "force-dynamic";

export default async function CrewSignInPage({ searchParams }: { searchParams: Promise<{ next?: string; demoDm?: string }> }) {
  const { next, demoDm } = await searchParams;
  // Proof only (VEND_DEMO_DM=1 and ?demoDm=1): shows the welcome card as it looks right after a sign-in with no sender key set.
  const demo = process.env.VEND_DEMO_DM === "1" && demoDm === "1";
  return (
    <>
      <Nav on="crew" />
      <main className="page narrow">
        <h1>Crew sign-in</h1>
        {demo ? <DmDemo text="Welcome to the Vend Scout crew, Maya. You signed in with nostr, so we are saying hello here and not by email. Your jobs are here: https://vend.frens.earth/jobs Your first open job is ready: Restock TEST Machine 03. Photo proof, then your sats land after it is checked. Pay 8,000 sats (test)." /> : <CrewSignIn next={next ?? "/work"} />}
        <p className="muted small">Not on the crew yet? Apply on the Crew page and add your npub. Once you are on the crew, this key opens the crew pages.</p>
      </main>
    </>
  );
}
