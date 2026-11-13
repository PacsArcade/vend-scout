import { headers } from "next/headers";
import { Nav } from "@/components/Nav";
import { CopyText } from "@/components/CopyText";
import { buildNotices } from "@/lib/notices";
import { originFrom } from "@/lib/origin";
import { readState } from "@/lib/store";
import { currentHeight } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const st = await readState();
  const now = await currentHeight();
  const notices = now.h === 0 ? [] : buildNotices(st, now.h, originFrom(await headers()));
  return (
    <>
      <Nav on="admin" />
      <main className="page">
        <h1>Drafts to post</h1>
        <p className="intro">Draft notices built from real records: machines that need a visit and machines just serviced. <b>Nothing is posted anywhere.</b> Copy the text and post it yourself. A crew name appears only for people who turned on public showing.</p>
        {now.h === 0 && <p className="notice bad" role="alert"><b>Block time is unavailable.</b>Drafts cannot be built right now.</p>}
        {notices.length === 0 && now.h !== 0 && <div className="glass card"><p className="muted">No drafts right now. Nothing needs a visit and nothing was just serviced.</p></div>}
        {notices.map((n) => (
          <div key={n.id} className="glass card">
            <div className="muted small">{n.kind === "service" ? "Needs a visit" : "Just serviced"} · {n.facts.join(" · ")}</div>
            <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}>{n.text}</p>
            <div className="actions"><CopyText text={n.text} /></div>
          </div>
        ))}
      </main>
    </>
  );
}
