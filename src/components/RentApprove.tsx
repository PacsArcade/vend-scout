"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvalUnsigned } from "@/lib/rentevent";

declare global { interface Window { nostr?: { signEvent: (e: unknown) => Promise<{ pubkey: string }> } } }

/** The operator signs the exact line text in their own browser (NIP-07). The server checks it. Nothing is paid by this button. */
export function RentApprove({ line, label }: { line: { id: string; sats: number; address: string }; label: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setMsg("");
    if (!window.nostr) return setMsg("No nostr signer in this browser.");
    setBusy(true);
    try {
      const ev = await window.nostr.signEvent(approvalUnsigned(line));
      const r = await fetch("/api/rent/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: ev }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!j?.ok) setMsg(j?.error ?? "That did not work"); else router.refresh();
    } catch { setMsg("Signing was declined. Nothing changed."); } finally { setBusy(false); }
  }
  return <><button className="btn gild" onClick={go} disabled={busy}>{label}</button>{msg && <span className="err small" role="alert">{msg}</span>}</>;
}
