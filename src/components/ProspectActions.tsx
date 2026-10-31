"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGES, type Stage } from "@/lib/types";

export function ProspectActions({ id, stage }: { id: string; stage: Stage }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const next = STAGES[Math.min(STAGES.length - 1, STAGES.indexOf(stage) + 1)];
  async function post(body: object) {
    await fetch(`/api/prospect/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    router.refresh();
  }
  return (
    <div className="noprint">
      <div className="actions">
        <button className="btn gild" onClick={() => window.print()}>Print pitch sheet</button>
        <button className="btn" disabled={stage === next} onClick={() => post({ stage: next })}>{stage === next ? "Placed" : `Mark as ${next}`}</button>
        <button className="btn" onClick={() => setAdding(!adding)}>Add a note</button>
      </div>
      {adding && (
        <form className="noteform" onSubmit={async (e) => { e.preventDefault(); if (text.trim()) { await post({ note: text }); setText(""); setAdding(false); } }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened?" aria-label="Note" maxLength={500} />
          <button className="btn gild" type="submit">Save note</button>
        </form>
      )}
    </div>
  );
}
