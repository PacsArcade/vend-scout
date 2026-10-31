"use client";
import { useState } from "react";
import { fetchLud16 } from "@/lib/profile";

export function DmCard({ dm, busy, again, onNext, onResend }: { dm: { sent: boolean; text: string }; busy: boolean; again: string; onNext: () => void; onResend: () => void }) {
  return (
    <div className="glass tile">
      <h2>{dm.sent ? "We sent you a private message" : "A welcome for you"}</h2>
      {dm.sent ? <p className="muted small">Check your nostr app. Only you can read it (NIP-17).</p> : <p className="muted small">We could not send a private message from here, so here it is.</p>}
      <p className="dmtext">{dm.text}</p>
      <div className="actions"><button className="btn gild full" onClick={onNext} disabled={busy}>See my first job</button><button className="btn full" onClick={onResend}>Resend the DM</button></div>
      {again && <p className="muted small" role="status">{again}</p>}
    </div>
  );
}

/** Proof only: the welcome card with fixed text. */
export function DmDemo({ text }: { text: string }) {
  return <DmCard dm={{ sent: false, text }} busy={false} again="" onNext={() => {}} onResend={() => {}} />;
}

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }

/** Crew sign-in with nostr (NIP-07). After it works, offer the Lightning address from their profile. */
export function CrewSignIn({ next }: { next: string }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<{ id: string; ln: string } | null>(null);
  const [dm, setDm] = useState<{ sent: boolean; text: string; skipped?: string; hasKey?: boolean; already?: boolean } | null>(null);
  const [after, setAfter] = useState<{ id: string; lightning: string | null; pubkey: string } | null>(null);
  const [again, setAgain] = useState("");
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
      const j = (await r.json().catch(() => null)) as { ok?: boolean; reason?: string; id?: string; lightning?: string | null; dm?: { sent: boolean; text: string; skipped?: string; hasKey?: boolean; already?: boolean } | null } | null;
      if (!r.ok || !j?.ok) { setBusy(false); return setErr(j?.reason ?? `The server answered ${r.status}. Your key is fine.`); }
      setBusy(false);
      // The welcome DM card comes first (sent, or shown here when no sender key is set). Then the Lightning address offer.
      if (j.dm && !j.dm.already) { setDm(j.dm); setAfter({ id: j.id!, lightning: j.lightning ?? null, pubkey: event.pubkey }); return; }
      await proceed({ id: j.id!, lightning: j.lightning ?? null, pubkey: event.pubkey });
    } catch { setBusy(false); setErr("Could not reach the server. Try again."); }
  }
  async function proceed(a: { id: string; lightning: string | null; pubkey: string }) {
    setBusy(true);
    const ln = await fetchLud16(a.pubkey);
    setBusy(false);
    if (ln && ln !== a.lightning) return setOffer({ id: a.id, ln });
    go();
  }
  async function resend() {
    setAgain("");
    const r = await fetch("/api/crew/dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; sent?: boolean; text?: string; skipped?: string; hasKey?: boolean; error?: string } | null;
    if (!j?.ok) return setAgain(j?.error ?? "That did not send");
    setDm({ sent: !!j.sent, text: j.text ?? "", skipped: j.skipped, hasKey: j.hasKey });
    setAgain(j.sent ? "Sent again. Check your nostr app." : "Not sent. The text is above.");
  }
  async function confirm() {
    if (!offer) return;
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "onboard", id: offer.id, lightning: offer.ln }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    if (!j.ok) return setErr(j.error ?? "That did not save");
    go();
  }

  if (dm && after) return <DmCard dm={dm} busy={busy} again={again} onNext={() => proceed(after)} onResend={resend} />;
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
