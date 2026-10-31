import type { Prospect } from "./types";

// Publishing a prospect's site from our templates. NOT built: v0 only previews.
// TODO: generate from the house template at ~/dev/apps/vanilla-template (read its skill first), deploy and domain are a later, separate decision.
// Do not call any hosting, DNS or registrar API from here until the Admiral rules on it.
export interface SiteDraft { prospectId: string; name: string; hours?: string; address?: string; phone?: string; localItems: string[]; pickupMachine?: string }
export interface SitePublisher {
  name: string;
  publish(draft: SiteDraft, prospect: Prospect): Promise<{ url: string }>;
}
export const noPublisher: SitePublisher = {
  name: "no publisher",
  async publish() { throw new Error("Publishing from templates is not built yet."); },
};
