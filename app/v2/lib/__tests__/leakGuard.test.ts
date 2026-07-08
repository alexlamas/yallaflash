import { describe, expect, it } from "vitest";
import { leakFreeEnglish, leaksWord } from "../leakGuard";
import { englishVariants, normalize } from "../gradingCore";

describe("leaksWord", () => {
  it("catches the word inflected inside an example", () => {
    // The real case: the "bel" card's correct option quoted "khalli belak".
    expect(leaksWord("mind / attention (as in 'khalli belak' = pay attention)", "bel")).toBe(true);
  });

  it("does not flag English words that merely embed the letters", () => {
    expect(leaksWord("banana", "ana")).toBe(false);
  });

  it("ignores short particles", () => {
    expect(leaksWord("the world", "w")).toBe(false);
  });
});

describe("leakFreeEnglish", () => {
  it("drops the self-revealing example", () => {
    const cleaned = leakFreeEnglish("mind / attention (as in 'khalli belak' = pay attention)", "bel");
    expect(cleaned).toBe("mind / attention");
  });

  it("still grades as an exact match after cleaning", () => {
    const original = "mind / attention (as in 'khalli belak' = pay attention)";
    const cleaned = leakFreeEnglish(original, "bel");
    // englishVariants covers the parens-free form, so a click on the cleaned
    // option must stay a deterministic pass against the original english.
    expect(englishVariants(original)).toContain(normalize(cleaned));
  });

  it("blanks a leak sitting in the prose itself", () => {
    const cleaned = leakFreeEnglish("what khallik means", "khallik");
    expect(cleaned.toLowerCase()).not.toContain("khallik");
  });

  it("leaves innocent text alone", () => {
    expect(leakFreeEnglish("fine (monetary penalty)", "gharame")).toBe("fine (monetary penalty)");
  });
});
