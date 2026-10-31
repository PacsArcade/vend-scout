/** A contact line for people. Reads VEND_CONTACT_EMAIL. Hidden when it is not set. */
export function contactEmail(): string | null {
  const e = (process.env.VEND_CONTACT_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}
export function ContactLine() {
  const e = contactEmail();
  if (!e) return null;
  return <p className="contactline">Contact: <a href={`mailto:${e}`}>{e}</a></p>;
}
