/** The coin-drop marker. Shown ONLY on a machine whose profile says it takes bitcoin (the Lightning board flag). */
export function BitcoinMark({ on, label = true }: { on: boolean; label?: boolean }) {
  if (!on) return null;
  return (
    <span className="btcmark" title="Takes bitcoin">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/03-coin-drop-icon.svg" alt="" width={20} height={20} />
      {label ? <span>Takes bitcoin</span> : <span className="sr">Takes bitcoin</span>}
    </span>
  );
}
