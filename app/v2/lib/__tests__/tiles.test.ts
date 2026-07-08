import { describe, expect, it } from "vitest";
import { buildTiles } from "../tiles";

describe("buildTiles", () => {
  it("splits a single word into letter tiles", () => {
    const set = buildTiles("ktir");
    expect(set).not.toBeNull();
    expect(set!.separator).toBe("");
    // Order is scrambled, but the tiles are exactly the word's letters.
    expect([...set!.tiles].sort()).toEqual(["i", "k", "r", "t"]);
  });

  it("splits a phrase into word tiles", () => {
    const set = buildTiles("kifak inta lyom");
    expect(set).not.toBeNull();
    expect(set!.separator).toBe(" ");
    expect([...set!.tiles].sort()).toEqual(["inta", "kifak", "lyom"]);
  });

  it("returns null when there's no real puzzle", () => {
    // Too few tiles to scramble meaningfully.
    expect(buildTiles("la")).toBeNull();
    expect(buildTiles("")).toBeNull();
    expect(buildTiles("  ")).toBeNull();
    // Every tile identical: only one possible assembly.
    expect(buildTiles("aaa")).toBeNull();
  });

  it("keeps duplicate letters as separate tiles", () => {
    const set = buildTiles("yalla");
    expect(set).not.toBeNull();
    expect(set!.tiles).toHaveLength(5);
    expect([...set!.tiles].sort()).toEqual(["a", "a", "l", "l", "y"]);
  });
});
