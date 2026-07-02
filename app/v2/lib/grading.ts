import Anthropic from "@anthropic-ai/sdk";

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

const NEAR_MISS_MAX_DISTANCE_RATIO = 0.25;

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
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
  const a = normalize(submitted);
  const b = normalize(expectedArabizi);
  if (!a) return false;
  if (a === b) return true;

  const distance = levenshtein(a, b);
  const nearMissThreshold = Math.max(1, Math.round(b.length * NEAR_MISS_MAX_DISTANCE_RATIO));
  if (distance > nearMissThreshold) return false;

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: `Expected Lebanese Arabic arabizi spelling: "${expectedArabizi}"\nUser's answer: "${submitted}"\n\nIs the user's answer a minor typo or acceptable alternate spelling of the SAME word (not a different word)? Reply with exactly one word: yes or no.`,
        },
      ],
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
 * The stored English often packs several acceptable renderings into one
 * string -- "a lot / very", "hello, hi", "to want (something)". Giving any
 * one of them (with or without a leading article or "to") is correct.
 */
export function englishVariants(expectedEnglish: string): string[] {
  const variants = new Set<string>([normalize(expectedEnglish)]);
  const withoutParens = expectedEnglish.replace(/\([^)]*\)/g, " ");
  variants.add(normalize(withoutParens));
  for (const part of withoutParens.split(/\/|,|;|\bor\b/i)) {
    const p = normalize(part);
    if (!p) continue;
    variants.add(p);
    variants.add(p.replace(/^(to|a|an|the) /, ""));
  }
  return [...variants].filter(Boolean);
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
  const answer = normalize(submitted);
  if (!answer) return false;
  if (englishVariants(expectedEnglish).includes(answer)) return true;
  if (!llmFallback) return false;

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 5,
      messages: [
        {
          role: "user",
          content: `A learner was asked the English meaning of a Lebanese Arabic word.\nAccepted meaning: "${expectedEnglish}"\nTheir answer: "${submitted}"\n\nDoes their answer express the same meaning? Allow synonyms and minor typos; reject different meanings. Reply with exactly one word: yes or no.`,
        },
      ],
    });
    const first = response.content[0];
    const text = first?.type === "text" ? first.text.trim().toLowerCase() : "no";
    return text.startsWith("yes");
  } catch {
    // API hiccup on the fallback call -- fall back to the strict result.
    return false;
  }
}
