import { describe, expect, it } from "vitest";
import { findOpenCard, scrubOpenCardAnswer, streamSafeText } from "../openCard";
import { buildServedLine } from "../tools";

// The parser MUST keep up with buildServedLine's real output: when the
// served line grew a `level=` token the old regex silently returned null,
// which turned off the answer scrub and the tutor started naming hidden
// answers in chat ("the 'I target / aim at' card is still up").
function servedRow(overrides: { level?: number; asks?: "to_english" | "to_target" } = {}) {
  const widget = {
    type: overrides.asks === "to_target" ? ("produce_cold" as const) : ("quiz_mc" as const),
    word_id: "w1",
    tier: "easy" as const,
    ...(overrides.level !== undefined ? { level: overrides.level } : {}),
    prompt: "",
    cue: {},
    options: [],
    answer: { arabizi: "bestahdef", english: "I target / I aim at" },
  };
  return {
    role: "user",
    content: buildServedLine(
      { id: "w1", arabizi: "bestahdef", english: "I target / I aim at" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      widget as any
    ),
  };
}

describe("findOpenCard", () => {
  it("parses a modern served line that carries a level token", () => {
    const card = findOpenCard([servedRow({ level: 3 })]);
    expect(card).not.toBeNull();
    expect(card!.wordId).toBe("w1");
    expect(card!.shown).toBe("bestahdef");
    expect(card!.hidden).toBe("I target / I aim at");
  });

  it("parses a legacy served line without a level token", () => {
    const card = findOpenCard([servedRow()]);
    expect(card).not.toBeNull();
    expect(card!.hidden).toBe("I target / I aim at");
  });

  it("flips shown/hidden for cards that ask for the word", () => {
    const card = findOpenCard([servedRow({ level: 4, asks: "to_target" })]);
    expect(card).not.toBeNull();
    expect(card!.shown).toBe("I target / I aim at");
    expect(card!.hidden).toBe("bestahdef");
  });

  it("returns null once the card's result has come back", () => {
    const rows = [servedRow({ level: 3 }), { role: "user", content: "[REVIEW RESULT] word_id=w1 correct=true" }];
    expect(findOpenCard(rows)).toBeNull();
  });
});

describe("scrubOpenCardAnswer", () => {
  const card = { wordId: "w1", shown: "bestahdef", hidden: "I target / I aim at" };

  it("swaps the hidden side for the shown side", () => {
    expect(scrubOpenCardAnswer(`the "I target / I aim at" card is still up`, card)).toBe(
      'the "bestahdef" card is still up'
    );
  });

  it("holds back a partial trailing match while streaming", () => {
    expect(streamSafeText("You're looking for I targ", card)).toBe("You're looking for ");
  });
});
