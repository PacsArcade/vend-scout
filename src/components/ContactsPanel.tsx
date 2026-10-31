"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact } from "@/lib/types";

const LABEL: Record<Contact["kind"], string> = { email: "Email", phone: "Phone", website: "Website", facebook: "Facebook", instagram: "Instagram" };

export function ContactsPanel({ id, osm, site, siteUrl, note, hasSite }: { id: string; osm: Contact[]; site: Contact[]; siteUrl: string | null; note?: string; hasSite: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function find() {
    setBusy(true); setMsg("Reading the website. This can take up to half a minute.");
    try {
      const r = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = (await r.json()) as { ok: boolean; error?: string; message?: string; note?: string; count?: number };
      setMsg(!j.ok ? (j.error ?? "That did not work.") : (j.message ?? j.note ?? `Found ${j.count} contacts.`));
      router.refresh();
    } catch { setMsg("The site read did not finish. Try again."); }
    setBusy(false);
  }
  const all = [...osm, ...site];
  return (
    <div className="glass card">
      <h2>Contacts</h2>
      {all.length === 0 && <p className="muted">No phone or email on the map{hasSite ? " yet. Press Find contacts to read their website." : ", and no website to read."}</p>}
      {all.length > 0 && (
        <table>
          <tbody>
            {all.map((c, i) => (
              <tr key={i}>
                <td className="muted small">{LABEL[c.kind]}</td>
                <td className="brk">{c.kind === "email" ? <a href={`mailto:${c.value}`}>{c.value}</a> : c.kind === "phone" ? <a href={`tel:${c.value}`}>{c.value}</a> : <a href={c.value} target="_blank" rel="noopener noreferrer">{c.value}</a>}</td>
                <td className="muted small brk">{c.source.startsWith("http") ? <a href={c.source} target="_blank" rel="noopener noreferrer">their page</a> : c.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {note && <p className="muted small">{note}</p>}
      {siteUrl && <p className="muted small brk">Website: {siteUrl}</p>}
      {hasSite && <div className="actions"><button className="btn" onClick={find} disabled={busy}>Find contacts</button></div>}
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}
