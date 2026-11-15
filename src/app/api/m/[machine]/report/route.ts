import crypto from "crypto";
import { NextResponse } from "next/server";
import { writeBin } from "@/lib/blobstore";
import { emailOk, mailReady, sendReportReply } from "@/lib/mail";
import { allow, clientKey } from "@/lib/ratelimit";
import { cleanPhoto, PHOTO_TYPE } from "@/lib/reportphoto";
import { perform, readState } from "@/lib/store";

/** How many reports one phone (one address) may send in an hour. */
export const REPORTS_PER_HOUR = 4;

// r23: report a problem without signing in. Public on purpose (see PUBLIC_API).
// POST multipart: reason, text, photo (required), email (optional, only when mail is set up), hp (honeypot).
// The picture is checked by its bytes, capped, and stripped of metadata before it is stored. It is never served publicly.
// The email, if given, gets one reply and is then dropped: it is not stored or logged.
export async function POST(req: Request, ctx: { params: Promise<{ machine: string }> }) {
  const { machine } = await ctx.params;
  if (!allow(`report:${clientKey(req)}`, REPORTS_PER_HOUR)) return NextResponse.json({ ok: false, error: "That is a lot of reports from this phone. Try again in an hour." }, { status: 429 });
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ ok: false, error: "The report did not come through. Try again." }, { status: 400 }); }
  if (String(fd.get("hp") ?? "")) return NextResponse.json({ ok: true, note: "Thank you. We got your report." }); // honeypot: save nothing
  const m = (await readState()).machines.find((x) => x.id === machine);
  if (!m || m.status !== "Placed") return NextResponse.json({ ok: false, error: "No such machine" }, { status: 404 });
  const email = String(fd.get("email") ?? "").trim();
  if (email && (!mailReady() || !emailOk(email))) return NextResponse.json({ ok: false, error: mailReady() ? "That email does not look right. Fix it or leave it empty." : "Email replies are not set up yet. Leave the email empty." }, { status: 400 });
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "Add a picture of the machine" }, { status: 400 });
  const clean = cleanPhoto(new Uint8Array(await file.arrayBuffer()));
  if (!clean.ok) return NextResponse.json({ ok: false, error: clean.error }, { status: 400 });
  const name = `rp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${clean.kind}`;
  // check the words before storing the picture, so a refused report leaves no file behind
  const reason = String(fd.get("reason") ?? ""), text = String(fd.get("text") ?? "").trim();
  if (text.length < 5) return NextResponse.json({ ok: false, error: "Say what is wrong in a few words" }, { status: 400 });
  await writeBin(`reports/${name}`, Buffer.from(clean.bytes), PHOTO_TYPE[clean.kind]);
  const r = await perform({ action: "publicReport", machine, reason, text, photo: name });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error ?? "The report was not saved" }, { status: 400 });
  let note = "Thank you. We got your report and an operator will look at it.";
  if (email) {
    const origin = new URL(req.url).origin;
    const sent = await sendReportReply(email, m.name, `${origin}/m/${m.id}`);
    note += sent ? " We sent one email to say so." : " The email did not go out, but your report is saved.";
  }
  return NextResponse.json({ ok: true, note });
}
