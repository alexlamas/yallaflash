import { describe, expect, it } from "vitest";
import { englishVariants, gradeRecognition, normalize } from "../grading";

describe("englishVariants", () => {
  it("splits slash-separated meanings", () => {
    expect(englishVariants("a lot / very")).toEqual(
      expect.arrayContaining(["a lot / very", "a lot", "very"])
    );
  });

  it("splits comma and 'or' separated meanings", () => {
    expect(englishVariants("hello, hi")).toEqual(expect.arrayContaining(["hello", "hi"]));
    expect(englishVariants("okay or fine")).toEqual(expect.arrayContaining(["okay", "fine"]));
  });

  it("does not split words containing 'or'", () => {
    expect(englishVariants("doctor")).toEqual(["doctor"]);
  });

  it("drops parenthetical qualifiers and leading to/articles", () => {
    expect(englishVariants("to want (something)")).toEqual(
      expect.arrayContaining(["to want", "want"])
    );
    expect(englishVariants("the sea")).toEqual(expect.arrayContaining(["the sea", "sea"]));
  });
});

describe("gradeRecognition (deterministic paths)", () => {
  it("accepts any variant of a multi-meaning answer", async () => {
    // Regression: "Very" against "a lot / very" was graded wrong.
    await expect(gradeRecognition("Very", "a lot / very")).resolves.toMatchObject({ correct: true });
    await expect(gradeRecognition("a lot", "a lot / very")).resolves.toMatchObject({ correct: true });
  });

  it("accepts the full stored string, as MC clicks submit it", async () => {
    await expect(
      gradeRecognition("a lot / very", "a lot / very", { llmFallback: false })
    ).resolves.toMatchObject({ correct: true });
  });

  it("is case and punctuation insensitive", async () => {
    await expect(gradeRecognition("  VERY!", "a lot / very")).resolves.toMatchObject({ correct: true });
  });

  it("rejects wrong answers without the fallback, with no partial credit", async () => {
    await expect(
      gradeRecognition("bread", "a lot / very", { llmFallback: false })
    ).resolves.toEqual({ correct: false });
    await expect(gradeRecognition("", "a lot / very")).resolves.toEqual({ correct: false });
  });
});

describe("normalize", () => {
  it("lowercases, trims, and strips punctuation", () => {
    expect(normalize("  Ktir!! ")).toBe("ktir");
  });
});

describe("gradeDeterministic", () => {
  const answer = { arabizi: "ktir", english: "a lot / very" };

  it("decides MC instantly, both ways", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    expect(gradeDeterministic("easy", "a lot / very", answer)).toBe(true);
    expect(gradeDeterministic("easy", "slowly", answer)).toBe(false);
  });

  it("grades reversed MC against the word itself, never deferring", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    expect(gradeDeterministic("easy", "ktir", answer, "to_target")).toBe(true);
    // Options are stored strings, but spelling equivalence still holds.
    expect(gradeDeterministic("easy", "kteer", answer, "to_target")).toBe(true);
    // A wrong click that happens to be CLOSE must not enter the near-miss
    // band -- the user saw the options and picked a different word.
    expect(gradeDeterministic("easy", "kbir", answer, "to_target")).toBe(false);
    expect(gradeDeterministic("easy", "shway", answer, "to_target")).toBe(false);
  });

  it("grades tile-builder assemblies (to_target on medium) deterministically", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    expect(gradeDeterministic("medium", "ktir", answer, "to_target")).toBe(true);
    // A wrong tile order is wrong -- the letters were on the table, so no
    // near-miss band and no model call.
    expect(gradeDeterministic("medium", "krit", answer, "to_target")).toBe(false);
  });

  it("decides exact typed recall instantly, defers synonyms", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    expect(gradeDeterministic("medium", "very", answer)).toBe(true);
    expect(gradeDeterministic("medium", "loads", answer)).toBe(null);
  });

  it("decides cold production: exact yes, near-miss deferred, distant no", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    expect(gradeDeterministic("hard", "ktir", answer)).toBe(true);
    expect(gradeDeterministic("hard", "shway", answer)).toBe(false);
  });

  it("accepts pure romanization spelling variance as correct", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    // Vowel doubling and e/i are spelling, not knowledge.
    expect(gradeDeterministic("hard", "kteer", answer)).toBe(true);
    // 2/q and o/u are the same sounds.
    expect(
      gradeDeterministic("hard", "bine2", { arabizi: "bne2", english: "I complain" })
    ).toBe(null); // inserted vowel: near-miss band, model judges
    expect(
      gradeDeterministic("hard", "shu", { arabizi: "chou", english: "what" })
    ).toBe(true);
  });

  it("defers near-misses measured on collapsed forms instead of failing them", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    // Raw distance 3 (instant wrong before); collapsed distance 1.
    expect(
      gradeDeterministic("hard", "fisto2", { arabizi: "fustuq", english: "peanuts" })
    ).toBe(null);
  });

  it("sends shares-letters answers to the checking state, not an instant miss", async () => {
    const { gradeDeterministic } = await import("../gradingCore");
    // A related-looking answer waits on the model (visible "checking...")
    // rather than flashing a wrong verdict the tutor then overturns.
    expect(
      gradeDeterministic("hard", "moukhayaym", { arabizi: "mukhayyam", english: "camping" })
    ).toBe(null);
    // Sharing letters cuts both ways: a DIFFERENT word at small edit distance
    // also defers, and the model rejects it there.
    expect(gradeDeterministic("hard", "kbir", answer)).toBe(null);
    // Genuinely unrelated answers still fail instantly.
    expect(
      gradeDeterministic("hard", "dno", { arabizi: "aghlab", english: "majority" })
    ).toBe(false);
  });
});

describe("normalizeRomanization", () => {
  it("collapses arabizi spelling equivalences", async () => {
    const { normalizeRomanization } = await import("../gradingCore");
    expect(normalizeRomanization("kteer")).toBe(normalizeRomanization("ktir"));
    expect(normalizeRomanization("chou")).toBe(normalizeRomanization("shu"));
    expect(normalizeRomanization("fustuq")).toBe(normalizeRomanization("fusto2"));
    expect(normalizeRomanization("leyle")).toBe(normalizeRomanization("leile"));
  });

  it("keeps genuinely different sounds apart", async () => {
    const { normalizeRomanization } = await import("../gradingCore");
    expect(normalizeRomanization("7abibi")).not.toBe(normalizeRomanization("habibi"));
    expect(normalizeRomanization("3am")).not.toBe(normalizeRomanization("am"));
  });
});
