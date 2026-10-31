// The shape of a crew posting that frens.earth can show. v0 only serves it from /api/crew/postings.
// TODO(frens.earth): the frens.earth jobs board reads this feed (or a signed copy of it). Do not change the frens.earth repo from here.
export interface FrensPosting {
  id: string;
  role: "runner" | "scout" | "keeper" | "tech";
  title: string;
  body: string;
  pay: { line: string; satsPerJob: number; job: string; testRate: boolean };
  area: { region: string; startingIn: string };
  applyUrl: string;
}
export interface FrensPostingFeed { source: "vend-scout"; updated: string; contractorNote: string; postings: FrensPosting[] }
