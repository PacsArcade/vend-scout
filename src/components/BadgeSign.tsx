"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BADGES, awardUnsigned, definitionUnsigned } from "@/lib/badgedefs";

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }

/**
 * The operator signs a NIP-58 event in their own browser (NIP-07). The app then sends the signed event on to its relays after checking it.
 * The app holds no key. Nothing is signed or sent until this button is pressed.
 */
export function BadgeSign({ d, origin, recipient, label, done }: { d: string; origin: string; recipient?: string; label: string; done?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setMsg(""); setOk(false);
    const b = BADGES.find((x) => x.d === d);
    if (!b) return setMsg("Unknown badge.");
    if (!window.nostr) return setMsg("No nostr signer in this browser.");
    setBusy(true);
    try {
      let unsigned;
      if (recipient) {
        const op = await (window.nostr as { getPublicKey?: () => Promise<string> }).getPublicKey?.();
        if (!op) return setMsg("Your signer did not give its key. Nothing changed.");
        unsigned = awardUnsigned(b, op, recipient);
      } else unsigned = definitionUnsigned(b, origin);
      const ev = await window.nostr.signEvent(unsigned);
      const r = await fetch("/api/admin/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: ev }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; relays?: number } | null;
      if (!j?.ok) setMsg(j?.error ?? "That did not work"); else { setOk(true); setMsg(`Published to ${j.relays} relay${j.relays === 1 ? "" : "s"}.`); router.refresh(); }
    } catch { setMsg("Signing was declined. Nothing was sent."); } finally { setBusy(false); }
  }
  return <><button className="btn gild" onClick={go} disabled={busy}>{done ? "Sign and publish again" : label}</button>{msg && <span className={(ok ? "okmsg small" : "err small") + " rl-msg"} role="alert">{msg}</span>}</>;
}
