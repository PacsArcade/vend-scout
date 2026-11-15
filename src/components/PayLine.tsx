import type { PayWay } from "@/lib/machinecard";

// r24: what a machine takes, said once, with a mark beside each way that has one.
// Bitcoin uses the house coin-drop mark. There is no cash or card mark in the logo set yet, so those are words only.
// Every mark sits beside its word, which screen readers read, so the image itself is decorative (alt="").
export function PayLine({ ways, lead = "Takes" }: { ways: PayWay[]; lead?: string }) {
  const word = (w: string, i: number) => (!lead && i === 0 ? w[0].toUpperCase() + w.slice(1) : w);
  if (!ways.length) return <span className="payline">No way to pay is recorded yet.</span>;
  const sep = (i: number) => (i === 0 ? "" : i === ways.length - 1 ? " or " : ", ");
  return (
    <span className="payline">
      {lead && <span>{lead} </span>}
      {ways.map((w, i) => (
        <span key={w}>{sep(i)}<span className="payway">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 20 px house SVG, nothing for next/image to do */}
          {w === "bitcoin" && <img src="/brand/03-coin-drop-icon.svg" alt="" width={20} height={20} />}
          {word(w, i)}
        </span></span>
      ))}
    </span>
  );
}
