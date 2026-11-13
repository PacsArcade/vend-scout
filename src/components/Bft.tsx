import { currentHeight } from "@/lib/time";
import { heightFor, stampText } from "@/lib/bft";
import { Stamp } from "./Stamp";

/** A stored record's time as a block height and BFT date. */
export async function Bft({ iso, h }: { iso?: string; h?: number }) {
  const now = await currentHeight();
  const height = heightFor(iso, h, now.h);
  if (now.h === 0) return <span className="mono stamp">time service unreachable</span>;
  return <Stamp h={height} />;
}

export async function NowStamp() {
  const now = await currentHeight();
  if (now.h === 0) return <span className="who">Block time unavailable</span>;
  return <span><Stamp h={now.h} />{now.live ? "" : " (last known, time service did not answer)"}</span>;
}

/** Same stamp as a plain string, for passing into client components. */
export async function stampString(iso?: string, h?: number): Promise<string> {
  const now = await currentHeight();
  return now.h === 0 ? "time service unreachable" : stampText(heightFor(iso, h, now.h));
}
