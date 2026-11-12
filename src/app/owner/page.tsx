import Link from "next/link";
import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { Bft } from "@/components/Bft";
import { OwedTable } from "@/components/OwedTable";
import { sessionKeyFromCookies } from "@/lib/profilesession";
import { linesForOwner, owedLines } from "@/lib/rent";
import { npubToHex } from "@/lib/operator";
import { readState } from "@/lib/store";
import { currentHeight } from "@/lib/time";
import { nip19 } from "nostr-tools";

export const dynamic = "force-dynamic";

// The owner's own page. Only the signed-in key's applications and rent lines are shown, never anyone else's.
export default async function OwnerPage() {
  const me = sessionKeyFromCookies((await headers()).get("cookie"));
  const st = await readState();
  const apps = me ? (st.hostApps ?? []).filter((a) => npubToHex(a.npub) === me) : [];
  const lines = linesForOwner(owedLines(st, (await currentHeight()).h), me);
  return (
    <>
      <Nav on="" />
      <main className="page narrow">
        <h1>Owner page</h1>
        {!me ? (
          <div className="glass card"><p>Sign in with nostr to see your application and your rent.</p><div className="actions"><Link className="btn gild" href="/owner/apply">Sign in and apply</Link></div></div>
        ) : (
          <>
            <p className="mono small brk">{nip19.npubEncode(me)}</p>
            <div className="glass card">
              <h2>Your application</h2>
              {apps.length === 0 ? <><p className="muted">No application from this key yet.</p><div className="actions"><Link className="btn gild" href="/owner/apply">Apply to host a machine</Link></div></> : apps.map((a) => (
                <div key={a.id}>
                  <p><b>{a.business}</b> <span className="chip">{a.stage}</span></p>
                  <p className="muted small">Sent <Bft iso={a.createdAt} h={a.h} /> · rent goes to {a.payout}{a.machine ? <> · machine {st.machines.find((m) => m.id === a.machine)?.name ?? a.machine}</> : null}</p>
                </div>
              ))}
            </div>
            <div className="glass card">
              <h2>Your rent</h2>
              <OwedTable lines={lines} operator={false} />
              <p className="muted small">Rent is counted in blocks from real sales. A line is paid only after an operator approves it, and nothing is sent automatically.</p>
            </div>
          </>
        )}
      </main>
    </>
  );
}
