"use client";
import { useRef } from "react";

/** The house pill button for choosing a file. Shows the chosen file name beside it. No raw browser file input is shown. */
export function FilePick({ label, file, onFile, accept = "image/jpeg,image/png,image/webp", capture }: { label: string; file: File | null; onFile: (f: File | null) => void; accept?: string; capture?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="filepick">
      <button type="button" className="btn" onClick={() => ref.current?.click()}>{label}</button>
      <input ref={ref} type="file" accept={accept} {...(capture ? { capture: "environment" as const } : {})} onChange={(e) => onFile(e.target.files?.[0] ?? null)} tabIndex={-1} />
      <span className="nm" role="status">{file ? file.name : "No photo chosen"}</span>
    </div>
  );
}
