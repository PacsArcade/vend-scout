"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function call(body: object): Promise<{ ok: boolean; error?: string; id?: string; code?: string }> {
  try {
    const r = await fetch("/api/do", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, error: "Could not reach the server" };
  }
}
const go = (tpl: string, r: { id?: string; code?: string }) => tpl.replace("{id}", r.id ?? "").replace("{code}", r.code ?? "");

export function ActionButton({ label, payload, gild, redirect, className = "" }: { label: string; payload: object; gild?: boolean; redirect?: string; className?: string }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className={"btn" + (gild ? " gild" : "") + (className ? " " + className : "")} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await call(payload);
        setBusy(false);
        if (!r.ok) return setErr(r.error ?? "That did not work");
        if (redirect) router.push(go(redirect, r)); else router.refresh();
      }}>{label}</button>
      {err && <span className="err" role="alert">{err}</span>}
    </>
  );
}

export interface Field { name: string; label: string; type?: "text" | "number" | "select"; options?: { value: string; label: string }[]; placeholder?: string; value?: string | number; wide?: boolean; min?: number; max?: number; optional?: boolean }

export function ActionForm({ action, fields, extra = {}, submit, redirect, doneText }: { action: string; fields: Field[]; extra?: object; submit: string; redirect?: string; doneText?: string }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const fd = new FormData(f);
      const body: Record<string, unknown> = { action, ...extra };
      for (const fl of fields) body[fl.name] = fl.type === "number" ? Number(fd.get(fl.name)) : String(fd.get(fl.name) ?? "");
      setBusy(true); setErr(""); setDone("");
      const r = await call(body);
      setBusy(false);
      if (!r.ok) return setErr(r.error ?? "That did not work");
      if (redirect) return router.push(go(redirect, r));
      f.reset(); setDone(doneText ?? "Saved."); router.refresh();
    }}>
      {fields.map((fl) => (
        <label key={fl.name} className={fl.wide ? "wide" : ""}>
          <span>{fl.label}</span>
          {fl.type === "select" ? (
            <select name={fl.name} defaultValue={fl.value}>{fl.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          ) : (
            <input name={fl.name} type={fl.type ?? "text"} placeholder={fl.placeholder} defaultValue={fl.value} min={fl.min} max={fl.max} required={!fl.optional} />
          )}
        </label>
      ))}
      <div className="formfoot"><button className="btn gild" type="submit" disabled={busy}>{submit}</button>
        {err && <span className="err" role="alert">{err}</span>}{done && <span className="okmsg" role="status">{done}</span>}</div>
    </form>
  );
}

export function PrintButton({ label }: { label: string }) {
  return <button className="btn gild" onClick={() => window.print()}>{label}</button>;
}
