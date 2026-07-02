import Anthropic from "@anthropic-ai/sdk";
import { gradeDeterministic } from "./gradingCore";

// The pure matching logic lives in gradingCore (shared with the client's
// instant-verdict path); this module adds the model fallback for the cases
// only a model can judge. Re-exported so existing imports/tests keep working.
export { normalize, levenshtein, englishVariants, gradeDeterministic } from "./gradingCore";

// Grading is a one-word yes/no call -- the fastest, cheapest model is right.
const MODEL = "claude-haiku-4-5";

// Constructed lazily so importing this module (e.g. in tests or without an
// API key) never touches the SDK; only the LLM fallback paths need it.
let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

async function askYesNo(prompt: string): Promise<boolean> {
  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 5,
      messages: [{ role: "user", content: prompt }],
    });
    const first = response.content[0];
    const text = first?.type === "text" ? first.text.trim().toLowerCase() : "no";
    return text.startsWith("yes");
  } catch {
    // API hiccup on the fallback call -- don't let it decide either way,
    // fall back to the strict deterministic result.
    return false;
  }
}

/**
 * Grades a cold-recall (produce_cold) answer against the stored arabizi.
 * Deterministic for exact matches and clear misses; only calls the model
 * for close near-misses (small edit distance), to tolerate typos/alt
 * spellings without letting the LLM decide correctness outright.
 */
export async function gradeColdRecall(
  submitted: string,
  expectedArabizi: string
): Promise<boolean> {
  const certain = gradeDeterministic("hard", submitted, { arabizi: expectedArabizi, english: "" });
  if (certain !== null) return certain;

  return askYesNo(
    `Expected Lebanese Arabic arabizi spelling: "${expectedArabizi}"\nUser's answer: "${submitted}"\n\nIs the user's answer a minor typo or acceptable alternate spelling of the SAME word (not a different word)? Reply with exactly one word: yes or no.`
  );
}

/**
 * Grades answers where the user gives the English meaning. Matching any
 * accepted variant is deterministic; everything else can fall back to a
 * model yes/no for typos and honest synonyms. MC quizzes must NOT use the
 * fallback -- clicking a wrong option that happens to be a synonym of the
 * right answer would get graded correct.
 */
export async function gradeRecognition(
  submitted: string,
  expectedEnglish: string,
  { llmFallback = true }: { llmFallback?: boolean } = {}
): Promise<boolean> {
  const certain = gradeDeterministic(llmFallback ? "medium" : "easy", submitted, {
    arabizi: "",
    english: expectedEnglish,
  });
  if (certain !== null) return certain;

  return askYesNo(
    `A learner was asked the English meaning of a Lebanese Arabic word.\nAccepted meaning: "${expectedEnglish}"\nTheir answer: "${submitted}"\n\nDoes their answer express the same meaning? Allow synonyms and minor typos; reject different meanings. Reply with exactly one word: yes or no.`
  );
}
