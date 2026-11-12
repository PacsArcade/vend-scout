"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VendProfile } from "@/lib/types";

/** The vend.frens only fields. Saved to our store through /api/profile, which only lets a key edit its own record. */
export function VendEditor({ initial }: { initial: VendProfile }) {
  const router = useRouter();
  const [f, setF] = useState({ blurb: initial.blurb, availability: initial.availability, showArea: initial.showArea, showJobs: initial.showJobs });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: f }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) return setMsg(j?.error ?? "That did not save.");
      setMsg("Saved."); router.refresh();
    } catch { setMsg("Could not reach the server."); } finally { setBusy(false); }
  }
  return (
    <div className="glass card">
      <h2>vend.frens only</h2>
      <p className="muted small">These stay on vend.frens. They are not published to nostr.</p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label>A line for the crew and neighbors<textarea rows={3} maxLength={400} value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} /></label>
        <label>When you are around<input maxLength={120} value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={f.showJobs} onChange={(e) => setF({ ...f, showJobs: e.target.checked })} /> Show my job count</label>
        <label className="check"><input type="checkbox" checked={f.showArea} onChange={(e) => setF({ ...f, showArea: e.target.checked })} /> Show my service area (neighborhood-sized cells, never an address)</label>
        <div className="actions"><button className="btn gild" type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</button></div>
        {msg && <p className="muted small" role="status">{msg}</p>}
      </form>
    </div>
  );
}
