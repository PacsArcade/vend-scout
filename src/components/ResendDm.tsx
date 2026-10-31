"use client";
import { useState } from "react";

/** "Resend the DM": sends the welcome again to the signed-in crew member's nostr key. */
export function ResendDm() {
  const [msg, setMsg] = useState("");
  const [text, setText] = useState("");
  async function go() {
    setMsg(""); setText("");
    const r = await fetch("/api/crew/dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; sent?: boolean; text?: string; skipped?: string; error?: string } | null;
    if (!j?.ok) return setMsg(j?.error ?? "That did not send. Sign in with nostr first.");
    if (j.sent) setMsg("Sent. Check your nostr app."); else { setMsg("Not sent. Here is the text:"); setText(j.text ?? ""); }
  }
  return (
    <div className="glass tile">
      <div className="actions" style={{ marginTop: 0 }}><button className="btn full" onClick={go}>Resend the DM</button></div>
      {msg && <p className="muted small" role="status">{msg}</p>}
      {text && <p className="dmtext">{text}</p>}
    </div>
  );
}
