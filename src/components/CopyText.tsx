"use client";
import { useState } from "react";

/** Copies a draft to the clipboard. Posts nothing. */
export function CopyText({ text }: { text: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setMsg("Copied"); } catch { setMsg("Could not copy. Select the text and copy it."); } setTimeout(() => setMsg(""), 3000); }}>Copy text</button>
      <span className="muted small" role="status">{msg}</span>
    </>
  );
}
