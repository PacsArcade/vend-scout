import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Qr } from "@/components/Qr";
import { Nav } from "@/components/Nav";
import { originFrom } from "@/lib/origin";
import { machineTag } from "@/lib/social";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

// Printable sticker for a machine (operator only: not on the public list). The QR points at the public machine page. No keys are made here.
export default async function StickerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = (await readState()).machines.find((x) => x.id === id);
  if (!m) notFound();
  const url = `${originFrom(await headers())}/m/${m.id}`;
  return (
    <>
      <div className="noprint"><Nav on="machines" /></div>
      <main className="page narrow">
        <div className="noprint"><h1>Sticker for {m.name}</h1><p className="muted small">Print this page (Ctrl+P). Only the sticker below prints. The QR opens {url}</p></div>
        <div className="sticker">
          <h2>{m.name}</h2>
          <Qr text={url} size={260} label={`QR code that opens the page for ${m.name}`} />
          <p className="mono">{url.replace(/^https?:\/\//, "")}</p>
          <p className="small">{machineTag(m.id)}</p>
          {m.npub && <p className="mono small" style={{ overflowWrap: "anywhere" }}>{m.npub}</p>}
        </div>
      </main>
    </>
  );
}
