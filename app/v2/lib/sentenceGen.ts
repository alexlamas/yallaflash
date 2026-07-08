import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_LANGUAGE } from "./language";
import type { WordLevel } from "./levels";
import type { ContextSentenceInput } from "./tools";

// Wraps app-served cards in a short generated sentence so review feels like
// a teacher testing the word in use, not flashing the stored string. The
// fast serve path stays deterministic at its core: this is a bounded,
// best-effort model call -- any failure, timeout, or odd output falls back
// to the plain card. buildReviewWidget re-validates the sentence (it must
// contain the word verbatim) and owns all leak rules (translation dropped on
// recognition tiers, cloze blanking on production).

// How often each level's card attempts a sentence. Levels 1-2 never do:
// their formats (reversed choice, tile builder) would print their own
// answer inside the sentence. Established words (level 5) always get
// context -- per the ladder, context IS the remaining challenge there.
const SENTENCE_ODDS: Record<WordLevel, number> = { 0: 0.35, 1: 0, 2: 0, 3: 0.5, 4: 0.5, 5: 1 };

// The serve path must stay snappy: prefetch hides this entirely, and a
// visible first serve at worst waits this long before giving up.
const TIMEOUT_MS = 3500;

// One line of arabizi is a Haiku-sized job, and Haiku answers in well under
// the timeout where the tutor's model wouldn't.
const MODEL = "claude-haiku-4-5-20251001";

export async function maybeContextSentence(
  word: { arabizi: string; english: string },
  level: WordLevel
): Promise<ContextSentenceInput | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (Math.random() >= SENTENCE_ODDS[level]) return null;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 200,
        system: `You write one-line example sentences for a ${DEFAULT_LANGUAGE.name} vocabulary app. Everything is spoken Lebanese/Levantine colloquial written in ${DEFAULT_LANGUAGE.romanization} (numerals: 2 = hamza/qaf, 3 = ayn, 7 = ha), never MSA.`,
        messages: [
          {
            role: "user",
            content: `Write one short, natural sentence (5-10 words) a teacher would use to test the word "${word.arabizi}" (meaning: ${word.english}).
Rules:
- The sentence must contain "${word.arabizi}" EXACTLY as written. Conjugate and inflect the words AROUND it naturally; never alter the word itself.
- Keep the surrounding words simple and common -- everyday life in Lebanon.
- The sentence must not contain the English meaning or an obvious synonym of it.
Reply with ONLY this JSON, nothing else: {"target": "<sentence in ${DEFAULT_LANGUAGE.romanization}>", "english": "<its English translation>"}`,
          },
        ],
      },
      { timeout: TIMEOUT_MS }
    );

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) return null;
    const parsed = JSON.parse(json[0]) as { target?: unknown; english?: unknown };
    if (typeof parsed.target !== "string" || typeof parsed.english !== "string") return null;
    return { target: parsed.target, english: parsed.english };
  } catch {
    // Timeouts, refusals, malformed JSON -- the plain card is always fine.
    return null;
  }
}
