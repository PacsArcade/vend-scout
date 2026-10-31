/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ProofView { id: string; title: string; who: string; before: string; after: string; ticked: string[]; loadTotal: number; sentStamp: string; resent: boolean }

export function ProofReview({ p }: { p: ProofView }) {
  const router = useRouter();
  const [glass, setGlass] = useState(false);
  const [load, setLoad] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(decision: "approve" | "retake") {
    setBusy(true); setErr("");
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reviewProof", id: p.id, decision, reason, glassClean: glass, loadMatches: load }) });
    const j = (await r.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "That did not work");
    router.refresh();
  }
  return (
    <div className="glass proofcard">
      <b>{p.title}</b>
      <span className="muted small">{p.who} · <span className="mono">{p.sentStamp}</span>{p.resent ? " · retake" : ""}</span>
      <div className="proofpics">
        <figure><img src={`/api/stopphoto/${p.before}`} alt="Glass before" /><figcaption>Before</figcaption></figure>
        <figure><img src={`/api/stopphoto/${p.after}`} alt="Glass after" /><figcaption>After</figcaption></figure>
        <figure><div className="tick">{p.loadTotal === 0 ? "No load list" : `${p.ticked.length} of ${p.loadTotal} ticked: ${p.ticked.join(", ") || "none"}`}</div><figcaption>Load list</figcaption></figure>
      </div>
      <label className="check small"><input type="checkbox" checked={glass} onChange={(e) => setGlass(e.target.checked)} /> <span>The glass looks clean</span></label>
      <label className="check small"><input type="checkbox" checked={load} onChange={(e) => setLoad(e.target.checked)} /> <span>The load list matches the photos</span></label>
      <button className="btn gild" onClick={() => go("approve")} disabled={busy}>Approve</button>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for a retake" aria-label="Reason for a retake" className="reasonin" />
      <button className="btn" onClick={() => go("retake")} disabled={busy}>Ask for a retake</button>
      {err && <span className="err" role="alert">{err}</span>}
    </div>
  );
}
