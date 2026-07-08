import Anthropic from "@anthropic-ai/sdk";
import { gradeDeterministic } from "./gradingCore";
import { DEFAULT_LANGUAGE } from "./language";

// The pure matching logic lives in gradingCore (shared with the client's
// instant-verdict path); this module adds the model fallback for the cases
// only a model can judge. Re-exported so existing imports/tests keep working.
export { normalize, levenshtein, englishVariants, gradeDeterministic } from "./gradingCore";

// Grading is a one-line structured call -- the fastest, cheapest model is right.
const MODEL = "claude-haiku-4-5";

// What grading resolves to. Deterministic outcomes are plain correct/wrong;
// the model fallback can additionally rule an answer HALF right -- the right
// word with a real error, or an overlapping-but-imprecise meaning. Partial
// credit schedules as "struggled" (rating 1): a shorter interval instead of
// the full 10-minute reset a miss gets.
export interface GradeVerdict {
  correct: boolean;
  // Only ever true when correct is false.
  partial?: boolean;
  // The model's one-line reason, when a model judged. Shown on the verdict
  // card so a non-obvious grade never looks arbitrary.
  note?: string;
}

// Constructed lazily so importing this module (e.g. in tests or without an
// API key) never touches the SDK; only the LLM fallback paths need it.
let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// The model owns the judgment call, not the schedule: it returns one of
// three verdicts (correct / partial / wrong) with a short reason, and the
// app maps that to a rating deterministically. JSON keeps it parseable;
// a malformed reply or API hiccup falls back to the strict result (wrong)
// rather than letting noise grade the answer.
async function askJudgment(prompt: string): Promise<GradeVerdict> {
  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });
    const first = response.content[0];
    const text = first?.type === "text" ? first.text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { correct: false };
    const parsed = JSON.parse(match[0]) as { verdict?: string; note?: string };
    const verdict = String(parsed.verdict ?? "").toLowerCase();
    const note = typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : undefined;
    if (verdict === "correct") return { correct: true, note };
    if (verdict === "partial") return { correct: false, partial: true, note };
    return { correct: false, note };
  } catch {
    // API hiccup on the fallback call -- don't let it decide either way,
    // fall back to the strict deterministic result.
    return { correct: false };
  }
}

const JUDGMENT_FORMAT = `Reply with ONLY this JSON, nothing else: {"verdict":"correct"|"partial"|"wrong","note":"<reason, 12 words max>"}`;

/**
 * Grades a cold-recall (produce_cold) answer against the stored arabizi.
 * Deterministic for exact matches and clear misses; only calls the model
 * for close near-misses (small edit distance). The model can also award
 * partial credit -- clearly the right word, but with a real error.
 */
export async function gradeColdRecall(
  submitted: string,
  expectedArabizi: string
): Promise<GradeVerdict> {
  const certain = gradeDeterministic("hard", submitted, { arabizi: expectedArabizi, english: "" });
  if (certain !== null) return { correct: certain };

  return askJudgment(
    `Expected ${DEFAULT_LANGUAGE.name} ${DEFAULT_LANGUAGE.romanization} spelling: "${expectedArabizi}"\nUser's answer: "${submitted}"\n\n${DEFAULT_LANGUAGE.romanization} has no standard orthography: vowels vary freely (kteer/ktir, bne2/bina2), and 2/q, o/u, e/i, ch/sh are interchangeable. Judge by pronunciation, not spelling: would a Lebanese speaker reading the user's answer aloud say the SAME word?\n- "correct": any plausible spelling of the same spoken word\n- "partial": recognizably the right word but with a real error -- a consonant wrong or missing, a garbled ending, the wrong form\n- "wrong": reads as a different word\n\n${JUDGMENT_FORMAT}`
  );
}

/**
 * Grades answers where the user gives the English meaning. Matching any
 * accepted variant is deterministic; everything else can fall back to a
 * model judgment for typos, honest synonyms, and half-right meanings. MC
 * quizzes must NOT use the fallback -- clicking a wrong option that happens
 * to be a synonym of the right answer would get graded correct.
 */
export async function gradeRecognition(
  submitted: string,
  expectedEnglish: string,
  { llmFallback = true }: { llmFallback?: boolean } = {}
): Promise<GradeVerdict> {
  const certain = gradeDeterministic(llmFallback ? "medium" : "easy", submitted, {
    arabizi: "",
    english: expectedEnglish,
  });
  if (certain !== null) return { correct: certain };

  return askJudgment(
    `A learner was asked the English meaning of a ${DEFAULT_LANGUAGE.name} word.\nAccepted meaning: "${expectedEnglish}"\nTheir answer: "${submitted}"\n\n- "correct": expresses the same meaning (synonyms and minor typos are fine)\n- "partial": overlaps the meaning but is incomplete or imprecise -- the right sphere, the wrong nuance\n- "wrong": a different meaning\n\n${JUDGMENT_FORMAT}`
  );
}
