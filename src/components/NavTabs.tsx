"use client";
import { useState } from "react";
import Link from "next/link";

export function NavTabs({ tabs, on }: { tabs: { key: string; label: string; href: string }[]; on: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn navmenu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mainnav">{open ? "Close menu" : "Menu"}</button>
      <nav id="mainnav" className={"tabs" + (open ? "" : " closed")} aria-label="Main">
        {tabs.map((t) => <Link key={t.key} href={t.href} className={"tab" + (t.key === on ? " on" : "")}>{t.label}</Link>)}
      </nav>
    </>
  );
}
