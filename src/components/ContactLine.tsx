/** A contact line for people. Reads VEND_CONTACT_EMAIL. Hidden when it is not set. */
export function contactEmail(): string | null {
  const e = (process.env.VEND_CONTACT_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
/** Every mail from the site arrives tagged, so a shared inbox can sort it. */
export const CONTACT_SUBJECT = "From the Vend Scout site (vend.frens.earth)";
export function ContactLine() {
  const e = contactEmail();
  if (!e) return null;
  return <p className="contactline">Contact: <a href={`mailto:${e}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`}>{e}</a></p>;
}
