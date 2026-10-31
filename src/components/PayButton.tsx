"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayButton({ machine, slot }: { machine: string; slot: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <>
      <button className="btn gild full" onClick={async () => {
        const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pay", machine, slot }) });
        const j = (await r.json()) as { ok: boolean; error?: string };
        setMsg(j.ok ? "Test payment recorded. One unit left the slot." : (j.error ?? "That did not work"));
        router.refresh();
      }}>Simulate a payment (test)</button>
      {msg && <p className="small okmsg" role="status">{msg}</p>}
    </>
  );
}
