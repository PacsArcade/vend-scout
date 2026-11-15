import { describe, expect, it } from "vitest";
import { agoLine, payWays, takesLine } from "./machinecard";

describe("r23 machine card facts", () => {
  it("says what a machine takes once, in words, never more than the profile records", () => {
    expect(takesLine({ lightning: true, cardReader: "", cash: true })).toBe("Takes bitcoin or cash");
    expect(takesLine({ lightning: true, cardReader: "", cash: false })).toBe("Takes bitcoin");
    expect(takesLine({ lightning: false, cardReader: "", cash: true })).toBe("Takes cash");
    expect(takesLine({ lightning: true, cardReader: "Nayax", cash: true })).toBe("Takes bitcoin, cards or cash");
    expect(takesLine({ lightning: false, cardReader: "  ", cash: false })).toBeNull();
    expect(payWays({ lightning: false, cardReader: "Nayax", cash: false })).toEqual(["cards"]);
  });
  it("says how long ago a machine was stocked", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(agoLine("2026-11-15T08:00:00Z", now)).toBe("Today");
    expect(agoLine("2026-11-14T08:00:00Z", now)).toBe("Yesterday");
    expect(agoLine("2026-11-13T08:00:00Z", now)).toBe("2 days ago");
    expect(agoLine("2026-10-01T08:00:00Z", now)).toBe("6 weeks ago");
    expect(agoLine("not a date", now)).toBe("Not known");
  });
});
