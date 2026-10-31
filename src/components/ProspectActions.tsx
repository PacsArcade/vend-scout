"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionButton, ActionForm, PrintButton } from "./Actions";
import { STAGES, type Stage } from "@/lib/types";

export function ProspectActions({ id, stage }: { id: string; stage: Stage | null }) {
  const [adding, setAdding] = useState(false);
  const cur = stage ? STAGES.indexOf(stage) : -1;
  const next = STAGES[Math.min(STAGES.length - 1, cur + 1)];
  return (
    <div className="noprint">
      <div className="actions">
        <PrintButton label="Print pitch sheet" />
        {stage === null && <ActionButton label="Track this place" payload={{ action: "stage", id, stage: "Found" }} />}
        {stage !== null && cur < STAGES.length - 1 && <ActionButton label={`Mark as ${next}`} payload={{ action: "stage", id, stage: next }} />}
        <button className="btn" onClick={() => setAdding(!adding)}>{adding ? "Close note" : "Add a note"}</button>
        <Link className="btn" href={`/machines/new?prospect=${encodeURIComponent(id)}`}>Place a machine here</Link>
      </div>
      {adding && <ActionForm action="note" extra={{ id }} fields={[{ name: "text", label: "Note", placeholder: "What happened?", wide: true }]} submit="Save note" doneText="Note saved." />}
    </div>
  );
}
