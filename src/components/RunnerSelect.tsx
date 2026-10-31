"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunnerSelect({ route, runner, runners }: { route: string; runner?: string; runners: { id: string; name: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <div className="searchrow">
      <select aria-label="Assign a runner" defaultValue={runner ?? ""} className="selbox" onChange={async (e) => {
        const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "routeRunner", id: route, runner: e.target.value }) });
        const j = (await r.json()) as { ok: boolean; error?: string };
        setMsg(j.ok ? "Saved." : (j.error ?? "That did not work")); router.refresh();
      }}>
        <option value="">Not assigned yet</option>
        {runners.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {msg && <span className="muted small" role="status">{msg}</span>}
    </div>
  );
}
