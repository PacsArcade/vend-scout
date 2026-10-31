import { NextResponse, type NextRequest } from "next/server";
import { crewPubkeyFromCookieHeader, gateOn, isCrewOnlyApi, isCrewPath, operatorFromCookieHeader, pathIsPublic } from "@/lib/operator";

// The operator gate for the live site. Local dev and tests are open (see gateOn).
export function proxy(req: NextRequest) {
  if (!gateOn()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (pathIsPublic(pathname, isApi)) return NextResponse.next();
  let op: string | null = null;
  try { op = operatorFromCookieHeader(req.headers.get("cookie")); } catch { op = null; }
  if (op) return NextResponse.next();
  let crew: string | null = null;
  try { crew = crewPubkeyFromCookieHeader(req.headers.get("cookie")); } catch { crew = null; }
  // A signed-in key may open the crew pages. The pages and /api/do then check it is still On the crew.
  if (crew && (isCrewPath(pathname) || isCrewOnlyApi(pathname))) return NextResponse.next();
  if (isApi) return NextResponse.json({ ok: false, error: "Operators only. Sign in first." }, { status: 401 });
  const url = req.nextUrl.clone();
  if (isCrewPath(pathname)) { url.pathname = "/crew/signin"; url.search = `?next=${encodeURIComponent(pathname)}`; } else { url.pathname = "/signin"; url.search = `?next=${encodeURIComponent(pathname)}`; }
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
