import Link from "next/link";
import { NavTabs } from "./NavTabs";
import { isOperatorNow } from "@/lib/auth";
import { LiveBft } from "./LiveBft";

const TABS = [
  { key: "scout", label: "Map", href: "/scout" },
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
      <Link href="/scout" className="brand" aria-label="VendFrens, home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/01-machine-fren-full.svg" alt="" width={102} height={40} />
      </Link>
      <span className="who">
        <span className="credit">a Pac&apos;s Arcade project</span>
        <LiveBft />
      </span>
      <NavTabs tabs={tabs} on={on} />
    </header>
  );
}
