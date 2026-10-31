import Link from "next/link";
import { NavTabs } from "./NavTabs";
import { isOperatorNow } from "@/lib/auth";
import { LiveBft } from "./LiveBft";

const TABS = [
  { key: "scout", label: "Scout", href: "/scout" },
  { key: "prospects", label: "Prospects", href: "/prospects" },
  { key: "machines", label: "Machines", href: "/machines" },
  { key: "shelf", label: "Local shelf", href: "/shelf" },
  { key: "orders", label: "Orders", href: "/orders" },
  { key: "routes", label: "Routes", href: "/routes" },
  { key: "jobs", label: "Jobs", href: "/jobs" },
  { key: "crew", label: "Crew", href: "/crew" },
  { key: "work", label: "Work", href: "/work" },
  { key: "admin", label: "Admin", href: "/admin" },
];

export async function Nav({ on }: { on: string }) {
  const op = await isOperatorNow();
  const tabs = op ? TABS : [TABS[0], TABS.find((t) => t.key === "crew")!, { key: "signin", label: "Operator sign-in", href: "/signin" }];
  return (
    <header className="top">
      <Link href="/scout" className="brand">frens.earth · Machines<small>working name</small></Link>
      <NavTabs tabs={tabs} on={on} />
      <span className="who">
        a Pac&apos;s Arcade project
        <LiveBft />
      </span>
    </header>
  );
}
