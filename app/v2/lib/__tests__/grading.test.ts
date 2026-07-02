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
    await expect(gradeRecognition("Very", "a lot / very")).resolves.toBe(true);
    await expect(gradeRecognition("a lot", "a lot / very")).resolves.toBe(true);
  });

  it("accepts the full stored string, as MC clicks submit it", async () => {
    await expect(
      gradeRecognition("a lot / very", "a lot / very", { llmFallback: false })
    ).resolves.toBe(true);
  });

  it("is case and punctuation insensitive", async () => {
    await expect(gradeRecognition("  VERY!", "a lot / very")).resolves.toBe(true);
  });

  it("rejects wrong answers without the fallback", async () => {
    await expect(gradeRecognition("bread", "a lot / very", { llmFallback: false })).resolves.toBe(
      false
    );
    await expect(gradeRecognition("", "a lot / very")).resolves.toBe(false);
  });
});

describe("normalize", () => {
  it("lowercases, trims, and strips punctuation", () => {
    expect(normalize("  Ktir!! ")).toBe("ktir");
  });
});
