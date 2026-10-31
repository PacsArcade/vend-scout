"use client";
import { useState } from "react";


/** Sign a fresh challenge with an operator key. Pattern from frens.earth's OperatorGate (extension door only for now). */
export function OperatorGate({ configured, next }: { configured: boolean; next: string }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setErr("");
    if (!window.nostr) return setErr("No signer extension in this browser. Use a desktop browser with a nostr signer for now.");
    setBusy(true);
    let event: unknown;
    try { event = await window.nostr.signEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [], content: `PACS-CONSOLE-${Date.now()}` }); }
    catch { setBusy(false); return setErr("Signing was declined. Nothing was sent."); }
    try {
      const r = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
      if (!r.ok || !j?.ok) { setBusy(false); return setErr(j?.reason ?? `The server answered ${r.status}. Your key is fine.`); }
      window.location.href = next.startsWith("/") ? next : "/admin";
    } catch { setBusy(false); setErr("Could not reach the server. Try again."); }
  }
  return (
    <div className="glass card narrowcard">
      <h2>Operators only</h2>
      <p className="muted">This side is for operators. Sign a fresh challenge with an operator key. There is no password.</p>
      {configured ? <div className="actions"><button className="btn gild full" onClick={verify} disabled={busy}>Verify my operator key</button></div> : <p className="muted small">No operator keys are set on this site yet.</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
