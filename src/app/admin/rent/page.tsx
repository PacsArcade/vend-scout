import { Nav } from "@/components/Nav";
import { OwedTable } from "@/components/OwedTable";
import { NOT_SENT, owedLines, rentCap } from "@/lib/rent";
import { readState } from "@/lib/store";
import { currentHeight } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function RentPage() {
  const st = await readState();
  const now = await currentHeight();
  const lines = owedLines(st, now.h);
  const cap = rentCap();
  const withRent = st.machines.filter((m) => m.rent);
  return (
    <>
      <Nav on="admin" />
      <main className="page wide-page">
        <h1>Rent owed to owners</h1>
        <p className="muted measure">Worked out from real sales (test sales left out) for each period of blocks. <b>Nothing here sends money.</b> Approving signs the line with your nostr key and records &ldquo;{NOT_SENT}&rdquo;. Cap per line: {cap.toLocaleString("en-US")} sats.</p>
        {now.h === 0 && <p className="err" role="alert">Block time is unavailable, so periods cannot be worked out right now.</p>}
        <section className="glass card"><h2>Owed lines</h2><OwedTable lines={lines} operator cap={cap} /></section>
        <section className="glass card">
          <h2>Terms on file</h2>
          {withRent.length === 0 ? <p className="muted">No machine has rent terms yet. Set them when you approve an owner, or on the machine page.</p> : (
            <table><thead><tr><th>Machine</th><th>Flat</th><th>Percent</th><th>Period</th><th>Started at block</th></tr></thead>
              <tbody>{withRent.map((m) => <tr key={m.id}><td>{m.name}</td><td className="num">{m.rent!.flatSats.toLocaleString("en-US")} sats</td><td className="num">{m.rent!.percent}%</td><td className="num">{m.rent!.periodBlocks.toLocaleString("en-US")} blocks</td><td className="num">{m.rent!.startH.toLocaleString("en-US")}</td></tr>)}</tbody></table>
          )}
        </section>
      </main>
    </>
  );
}
