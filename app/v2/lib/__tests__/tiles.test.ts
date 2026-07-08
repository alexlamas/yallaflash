import { describe, expect, it } from "vitest";
import { buildTiles } from "../tiles";

// Pulls the decoys out of a letter-mode tile set: whatever's left after
// removing exactly one tile per letter of the word.
function splitBank(tiles: string[], word: string) {
  const remaining = [...tiles];
  for (const letter of word) {
    const i = remaining.indexOf(letter);
    expect(i).toBeGreaterThanOrEqual(0);
    remaining.splice(i, 1);
  }
  return remaining;
}

describe("buildTiles", () => {
  it("splits a single word into letter tiles plus decoys", () => {
    const set = buildTiles("ktir");
    expect(set).not.toBeNull();
    expect(set!.separator).toBe("");
    expect(set!.size).toBe(4);
    // The bank holds every letter of the word, plus a few wrong ones.
    const decoys = splitBank(set!.tiles, "ktir");
    expect(decoys.length).toBeGreaterThanOrEqual(2);
    // A decoy matching a real letter wouldn't be a decoy.
    for (const decoy of decoys) {
      expect("ktir").not.toContain(decoy.toLowerCase());
    }
  });

  it("splits a phrase into word tiles without decoys", () => {
    const set = buildTiles("kifak inta lyom");
    expect(set).not.toBeNull();
    expect(set!.separator).toBe(" ");
    expect(set!.size).toBe(3);
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
    expect(set!.size).toBe(5);
    const decoys = splitBank(set!.tiles, "yalla");
    expect(set!.tiles).toHaveLength(5 + decoys.length);
  });
});
