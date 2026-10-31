import type { MachineType } from "@/lib/types";

// Simple line drawings, one per machine type. Pure SVG, no photos.
export function TypeDrawing({ type, size = 96 }: { type: MachineType; size?: number }) {
  const common = { fill: "none", stroke: "#d4a843", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const body = <rect x="14" y="8" width="52" height="64" rx="5" {...common} />;
  const shapes: Record<MachineType, React.ReactNode> = {
    snack: <>{body}<path d="M20 22h40M20 36h40M20 50h40" {...common} /><rect x="22" y="26" width="8" height="8" {...common} /><rect x="36" y="26" width="8" height="8" {...common} /><rect x="22" y="40" width="8" height="8" {...common} /><rect x="22" y="58" width="36" height="8" rx="2" {...common} /></>,
    drinks: <>{body}<path d="M24 16v36M32 16v36M40 16v36M48 16v36M56 16v36" {...common} /><rect x="22" y="58" width="36" height="8" rx="2" {...common} /></>,
    combo: <>{body}<path d="M20 20h40M20 34h40" {...common} /><path d="M26 40v16M36 40v16M46 40v16M56 40v16" {...common} /><rect x="22" y="60" width="36" height="6" rx="2" {...common} /></>,
    fresh: <>{body}<path d="M20 28h40M20 46h40" {...common} /><circle cx="30" cy="20" r="4" {...common} /><path d="M44 20h12M24 38h12M24 56h14" {...common} /></>,
    coffee: <><rect x="20" y="8" width="40" height="64" rx="5" {...common} /><rect x="28" y="16" width="24" height="12" rx="2" {...common} /><path d="M32 44h16v16H32zM48 48h5a3 3 0 010 8h-5" {...common} /></>,
    cards: <>{body}<rect x="24" y="16" width="14" height="20" rx="2" {...common} /><rect x="42" y="16" width="14" height="20" rx="2" {...common} /><rect x="24" y="42" width="14" height="14" rx="2" {...common} /><path d="M46 49h10" {...common} /></>,
    art: <>{body}<rect x="22" y="16" width="36" height="24" rx="2" {...common} /><path d="M26 36l8-8 6 6 6-9 6 11" {...common} /><path d="M22 50h36M22 60h24" {...common} /></>,
    lockers: <>{body}<path d="M40 8v64M14 28h52M14 50h52" {...common} /><path d="M32 18h2M32 40h2M32 61h2M46 18h2M46 40h2M46 61h2" {...common} /></>,
    claw: <>{body}<path d="M40 14v12M32 34l8-8 8 8M34 38v6M46 38v6" {...common} /><path d="M20 62h40" {...common} /><circle cx="30" cy="56" r="3" {...common} /><circle cx="42" cy="55" r="3" {...common} /></>,
    other: <>{body}<path d="M33 30a7 7 0 1114 0c0 6-7 6-7 12" {...common} /><path d="M40 52v1" {...common} /></>,
  };
  return <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={`Line drawing of a ${type} machine`}>{shapes[type]}</svg>;
}
