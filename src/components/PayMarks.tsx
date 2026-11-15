import { BTC_SIGN_LEAN, BTC_SIGN_PATH } from "@/lib/hexart";
import { MARK_INK, takesSaid, type PayWay } from "@/lib/machinecard";

// r26: the machine card shows the marks for the money, not the words (his pin on r25a: "show the logos for the money so bitcoin emoji or $").
// Bitcoin is the drawn sign (BTC_SIGN_PATH, never a letter or a font glyph). Cash is "$". Only the ways the machine takes show.
// The marks are hidden from screen readers; one line says it instead: "Takes bitcoin and cash".
// A card reader has no mark yet, so it stays a word.
export function PayMarks({ ways }: { ways: PayWay[] }) {
  const said = takesSaid(ways);
  if (!said) return <span className="paymarks none">No way to pay is recorded yet.</span>;
  return (
    <span className="paymarks">
      <span className="sr">{said}</span>
      <span className="pm" aria-hidden="true">
        {ways.map((w) =>
          w === "bitcoin" ? (
            <svg key={w} className="pm-btc" data-way="bitcoin" width="17" height="24" viewBox="-8 -11 16 22" focusable="false">
              <path d={BTC_SIGN_PATH} fill={MARK_INK.bitcoin} transform={`rotate(${BTC_SIGN_LEAN})`} />
            </svg>
          ) : w === "cash" ? (
            <b key={w} className="pm-cash" data-way="cash" style={{ color: MARK_INK.cash }}>$</b>
          ) : (
            <span key={w} className="pm-word" data-way="cards" style={{ color: MARK_INK.cards }}>Card</span>
          ),
        )}
      </span>
    </span>
  );
}
