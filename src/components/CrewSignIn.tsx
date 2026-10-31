"use client";
import { useState } from "react";
import { fetchLud16 } from "@/lib/profile";

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }

/** Crew sign-in with nostr (NIP-07). After it works, offer the Lightning address from their profile. */
export function CrewSignIn({ next }: { next: string }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<{ id: string; ln: string } | null>(null);
  const go = () => { window.location.href = next.startsWith("/") ? next : "/work"; };

  async function sign() {
    setErr("");
    if (!window.nostr) return setErr("No nostr signer in this browser. Install one like the nos2x or Alby extension, then try again.");
    setBusy(true);
    let event: { pubkey: string };
    try { event = await window.nostr.signEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [], content: `PACS-CREW-${Date.now()}` }); }
    catch { setBusy(false); return setErr("Signing was declined. Nothing was sent."); }
    try {
      const r = await fetch("/api/crew/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; reason?: string; id?: string; lightning?: string | null } | null;
      if (!r.ok || !j?.ok) { setBusy(false); return setErr(j?.reason ?? `The server answered ${r.status}. Your key is fine.`); }
      const ln = await fetchLud16(event.pubkey);
      setBusy(false);
      if (ln && ln !== j.lightning) return setOffer({ id: j.id!, ln });
      go();
    } catch { setBusy(false); setErr("Could not reach the server. Try again."); }
  }
  async function confirm() {
    if (!offer) return;
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "onboard", id: offer.id, lightning: offer.ln }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    if (!j.ok) return setErr(j.error ?? "That did not save");
    go();
  }

  if (offer) return (
    <div className="glass tile">
      <h2>Use this for your pay?</h2>
      <p>Your nostr profile has a Lightning address. Is this where your sats should go?</p>
      <p className="brk"><b>{offer.ln}</b></p>
      <div className="actions"><button className="btn gild full" onClick={confirm}>Yes, use it</button><button className="btn full" onClick={go}>Not now</button></div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
  return (
    <div className="glass tile">
      <h2>Sign in with nostr</h2>
      <p className="muted small">You need a nostr signer, like the nos2x or Alby browser extension. We never see your private key. Only crew members linked to their npub can sign in.</p>
      <div className="actions"><button className="btn gild full" onClick={sign} disabled={busy}>Sign in with nostr</button></div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
