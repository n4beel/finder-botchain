import { describe, it, expect } from "vitest";
import { split, finderLink, parseFinderParam, MIN_PRICE, MAX_PRICE, MIN_BPS, MAX_BPS } from "../finder";

describe("Finder Pure Utilities", () => {
  it("splits price without finder", () => {
    const s = split(1000n, 1000, false);
    expect(s.toSeller).toBe(1000n);
    expect(s.toFinder).toBe(0n);
  });

  it("splits price with finder correctly", () => {
    // 10% (1000 bps) of 1 ether (10^18) = 0.1 ether
    const s = split(1_000_000_000_000_000_000n, 1000, true);
    expect(s.toFinder).toBe(100_000_000_000_000_000n);
    expect(s.toSeller).toBe(900_000_000_000_000_000n);
  });

  it("handles odd values and small amounts including 1 wei", () => {
    const s1 = split(1n, 1000, true);
    // 1 * 1000 / 10000 = 0
    expect(s1.toFinder).toBe(0n);
    expect(s1.toSeller).toBe(1n);

    const sOdd = split(1000000000000001n, 1500, true); // 15%
    expect(sOdd.toSeller + sOdd.toFinder).toBe(1000000000000001n);
  });

  it("generates finder link accurately", () => {
    const link = finderLink("https://finder.botchain.ai", 42n, "0x1111111111111111111111111111111111111111");
    expect(link).toBe("https://finder.botchain.ai/offer/42?f=0x1111111111111111111111111111111111111111");
  });

  it("validates and parses finder query param", () => {
    expect(parseFinderParam("")).toBeNull();
    expect(parseFinderParam("not-an-address")).toBeNull();
    expect(parseFinderParam("0x1111111111111111111111111111111111111111")).toBe(
      "0x1111111111111111111111111111111111111111"
    );
  });

  it("matches contract parameters", () => {
    expect(MIN_PRICE).toBe(1_000_000_000_000_000n);
    expect(MAX_PRICE).toBe(1_000_000_000_000_000_000_000_000n);
    expect(MIN_BPS).toBe(100);
    expect(MAX_BPS).toBe(3000);
  });
});
