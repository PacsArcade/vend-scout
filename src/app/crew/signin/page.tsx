import { Nav } from "@/components/Nav";
import { CrewSignIn } from "@/components/CrewSignIn";

export const dynamic = "force-dynamic";

export default async function CrewSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <Nav on="crew" />
      <main className="page narrow">
        <h1>Crew sign-in</h1>
        <CrewSignIn next={next ?? "/work"} />
        <p className="muted small">Not on the crew yet? Apply on the Crew page and add your npub. Once you are on the crew, this key opens the crew pages.</p>
      </main>
    </>
  );
}
