import { describe, expect, it } from "vitest";
import { bftDatePlain, bftTime, heightFor, stampText } from "./bft";

describe("bft", () => {
  it("block 0 is 0000.01.01 00:00", () => {
    expect(bftDatePlain(0)).toBe("0000.01.01");
    expect(bftTime(0)).toBe("00:00");
  });
  it("one day is 144 blocks, one year is 52416", () => {
    expect(bftDatePlain(144)).toBe("0000.01.02");
    expect(bftDatePlain(52416)).toBe("0001.01.01");
  });
  it("stamp leads with the block, then date and time with the marker after", () => expect(stampText(973997)).toMatch(/^block 973,997 · \d{4}\.\d{2}\.\d{2} \d{2}:\d{2} a₿$/));
  it("a saved height wins over an estimate", () => expect(heightFor("2020-01-01", 5, 100)).toBe(5));
});
