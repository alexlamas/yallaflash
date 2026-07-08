import { describe, expect, it } from "vitest";
import { levelForProgress, tierForLevel } from "../levels";

describe("levelForProgress", () => {
  it("starts every untested word at level 0", () => {
    expect(levelForProgress(null)).toBe(0);
    expect(levelForProgress({ status: "new", review_count: 0 })).toBe(0);
    // A progress row with no reviews yet is still brand new.
    expect(levelForProgress({ status: "learning", review_count: 0 })).toBe(0);
  });

  it("climbs one rung per review while learning, capped at 3", () => {
    expect(levelForProgress({ status: "learning", review_count: 1 })).toBe(1);
    expect(levelForProgress({ status: "learning", review_count: 2 })).toBe(2);
    expect(levelForProgress({ status: "learning", review_count: 3 })).toBe(3);
    // A word the user keeps failing stays parked at typed recall.
    expect(levelForProgress({ status: "learning", review_count: 9 })).toBe(3);
  });

  it("splits learned words by interval: fresh at 4, established at 5", () => {
    expect(levelForProgress({ status: "learned", review_count: 4, interval: 1 })).toBe(4);
    expect(levelForProgress({ status: "learned", review_count: 4, interval: 6 })).toBe(4);
    expect(levelForProgress({ status: "learned", review_count: 6, interval: 7 })).toBe(5);
    expect(levelForProgress({ status: "learned", review_count: 9, interval: 30 })).toBe(5);
    // Older rows may lack the interval -- treat as freshly learned.
    expect(levelForProgress({ status: "learned", review_count: 4 })).toBe(4);
  });

  it("re-enters a failed learned word at level 3, not the bottom", () => {
    // Failing drops status back to learning; review_count stays high.
    expect(levelForProgress({ status: "learning", review_count: 12, interval: 0.007 })).toBe(3);
  });
});

describe("tierForLevel", () => {
  it("keeps levels 0-2 in the easy bucket so learned is only earned by typing", () => {
    expect(tierForLevel(0)).toBe("easy");
    expect(tierForLevel(1)).toBe("easy");
    expect(tierForLevel(2)).toBe("easy");
    expect(tierForLevel(3)).toBe("medium");
    expect(tierForLevel(4)).toBe("hard");
    expect(tierForLevel(5)).toBe("hard");
  });
});
