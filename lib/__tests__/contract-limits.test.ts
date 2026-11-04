import { describe, it, expect } from "vitest";
import { BOTCHAIN_ABI } from "../botchain/abi";

describe("Finder ABI checks", () => {
  it("includes all required methods", () => {
    const fnNames = BOTCHAIN_ABI.filter((x) => x.type === "function").map((x: any) => x.name);
    expect(fnNames).toContain("list");
    expect(fnNames).toContain("buy");
    expect(fnNames).toContain("withdraw");
    expect(fnNames).toContain("offerOf");
    expect(fnNames).toContain("foundOn");
    expect(fnNames).toContain("quoteSplit");
    expect(fnNames).toContain("latest");
    expect(fnNames).toContain("pending");
    expect(fnNames).toContain("earned");
    expect(fnNames).toContain("found");
    expect(fnNames).toContain("offerCount");
  });

  it("includes all required events", () => {
    const eventNames = BOTCHAIN_ABI.filter((x) => x.type === "event").map((x: any) => x.name);
    expect(eventNames).toContain("Listed");
    expect(eventNames).toContain("Bought");
    expect(eventNames).toContain("Withdrawn");
  });
});
