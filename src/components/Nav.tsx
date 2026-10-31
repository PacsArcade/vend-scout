import Link from "next/link";
import { NavTabs } from "./NavTabs";
import { currentHeight } from "@/lib/time";
import { stampText } from "@/lib/bft";

const TABS = [
  { key: "scout", label: "Scout", href: "/scout" },
  { key: "prospects", label: "Prospects", href: "/prospects" },
  { key: "machines", label: "Machines", href: "/machines" },
  { key: "shelf", label: "Local shelf", href: "/shelf" },
  { key: "orders", label: "Orders", href: "/orders" },
  { key: "routes", label: "Routes", href: "/routes" },
  { key: "jobs", label: "Jobs", href: "/jobs" },
  { key: "crew", label: "Crew", href: "/crew" },
];

export async function Nav({ on }: { on: string }) {
  const now = await currentHeight();
  return (
    <header className="top">
      <Link href="/scout" className="brand">frens.earth · Machines<small>working name</small></Link>
      <NavTabs tabs={TABS} on={on} />
      <span className="who">
        a Pac&apos;s Arcade project
        <span className="stamp mono">{now.h === 0 ? "Block time unavailable" : stampText(now.h)}{now.h !== 0 && !now.live ? " (last known)" : ""}</span>
      </span>
    </header>
  );
}
