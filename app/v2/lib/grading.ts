import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";

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
    const response = await anthropic.messages.create({
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

/** Grades multiple-choice / open-English-recall answers: exact normalized match. */
export function gradeRecognition(submitted: string, expectedEnglish: string): boolean {
  return normalize(submitted) === normalize(expectedEnglish);
}
