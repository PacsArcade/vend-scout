import { isOperatorNow } from "@/lib/auth";
import { STORAGE_MISSING, storageMissing } from "@/lib/blobstore";

/** A red banner for operators when the live site has no storage connected. */
export async function StorageBanner() {
  if (!storageMissing() || !(await isOperatorNow())) return null;
  return <p className="storagebanner" role="alert">{STORAGE_MISSING}</p>;
}
