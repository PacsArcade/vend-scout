// r23: the one email a public reporter can ask for. The repo had no mail sender before this.
// Off unless both keys are set (VEND_MAIL_KEY, a Resend API key, and VEND_MAIL_FROM, the sending address). Keys go in by the
// key door, never in chat or the repo. With no sender set the form hides the email field: nothing pretends to send.
// The address is used for this one reply and then dropped. It is never stored, listed or shown.

export const mailReady = () => !!process.env.VEND_MAIL_KEY?.trim() && !!process.env.VEND_MAIL_FROM?.trim();

/** A plain check for a usable address. Not a promise it exists. */
export const emailOk = (s: string) => s.length <= 200 && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(s);

/** The words of the reply. Plain text, no tracking, no links but the sign-up page. */
export function reportReply(machineName: string, signUpUrl: string): { subject: string; text: string } {
  return {
    subject: `We got your report on ${machineName}`,
    text: [
      `Thank you for telling us about ${machineName}. Your report and picture reached us, and an operator will look at it.`,
      "",
      `Want vending machine credits for reports and checks? Sign up as a fren with a nostr key here: ${signUpUrl}`,
      "",
      "We used your email only to send this one note. It is not on any list and we do not keep it.",
      "",
      "VendFrens, a Pac's Arcade project",
    ].join("\n"),
  };
}

/** Send the reply. Returns false when mail is off or the sender did not take it; never throws. */
export async function sendReportReply(to: string, machineName: string, signUpUrl: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!mailReady() || !emailOk(to)) return false;
  const { subject, text } = reportReply(machineName, signUpUrl);
  try {
    const r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.VEND_MAIL_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.VEND_MAIL_FROM!.trim(), to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch { return false; }
}
