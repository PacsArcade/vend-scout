import { cookies } from "next/headers";
import { gateOn, operatorFromCookieHeader, OPERATOR_COOKIE } from "./operator";

/** Server components: is this visitor an operator? Always true when the gate is off (local dev). */
export async function isOperatorNow(): Promise<boolean> {
  if (!gateOn()) return true;
  try { return !!operatorFromCookieHeader(`${OPERATOR_COOKIE}=${(await cookies()).get(OPERATOR_COOKIE)?.value ?? ""}`); } catch { return false; }
}
