import Link from "next/link";

const TABS = [
  { key: "scout", label: "Scout", href: "/scout" },
  { key: "prospects", label: "Prospects", href: "/prospects" },
  { key: "machines", label: "Machines", href: "/machines" },
  { key: "shelf", label: "Local shelf", href: "/shelf" },
  { key: "orders", label: "Orders", href: "/orders" },
];

export function Nav({ on }: { on: string }) {
  return (
    <header className="top">
      <Link href="/scout" className="brand">frens.earth · Machines<small>working name</small></Link>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={"tab" + (t.key === on ? " on" : "")}>{t.label}</Link>
        ))}
      </nav>
      <span className="who">a Pac&apos;s Arcade project</span>
    </header>
  );
}
