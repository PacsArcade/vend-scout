"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

/** Who am I. Local dev and operators pick a name. On the live site a crew member is whoever signed in with nostr. */
export function CrewSwitch({ crew, current, locked }: { crew: { id: string; name: string }[]; current?: string; locked?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (locked) return;
    if (!current) { const me = localStorage.getItem("vs-me"); if (me && crew.some((c) => c.id === me)) router.replace(`${path}?crew=${me}`); }
  }, [current, crew, path, router, locked]);
  if (locked) {
    const name = crew.find((c) => c.id === current)?.name;
    return name ? <p className="muted small">Signed in as {name}</p> : <p><Link className="btn gild full" href={`/crew/signin?next=${encodeURIComponent(path)}`}>Sign in with nostr</Link></p>;
  }
  return (
    <label className="runpick"><span>I am</span>
      <select value={current ?? ""} onChange={(e) => { localStorage.setItem("vs-me", e.target.value); router.replace(e.target.value ? `${path}?crew=${e.target.value}` : path); }}>
        <option value="">Pick your name</option>
        {crew.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
