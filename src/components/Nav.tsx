import Link from "next/link";

const TABS = [
  { key: "scout", label: "Scout", href: "/scout" },
  { key: "prospects", label: "Prospects", href: "/prospects/suds-24" },
  { key: "machines", label: "Machines 1", href: "/machines/m01" },
  { key: "orders", label: "Orders", href: "/pickup/4219" },
  { key: "votes", label: "Votes", href: "/vote/m01" },
];

export function Nav({ on }: { on: string }) {
  return (
    <div className="top">
      <span className="brand">VEND SCOUT<small>Chicago · working name</small></span>
      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={"tab" + (t.key === on ? " on" : "")}>{t.label}</Link>
        ))}
      </nav>
      <span className="who">Whisper · Pac</span>
    </div>
  );
}
