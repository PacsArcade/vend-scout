"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/** Who am I. Remembered on this phone. No sign-in in v0. */
export function CrewSwitch({ crew, current }: { crew: { id: string; name: string }[]; current?: string }) {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!current) { const me = localStorage.getItem("vs-me"); if (me && crew.some((c) => c.id === me)) router.replace(`${path}?crew=${me}`); }
  }, [current, crew, path, router]);
  return (
    <label className="runpick"><span>I am</span>
      <select value={current ?? ""} onChange={(e) => { localStorage.setItem("vs-me", e.target.value); router.replace(e.target.value ? `${path}?crew=${e.target.value}` : path); }}>
        <option value="">Pick your name</option>
        {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
