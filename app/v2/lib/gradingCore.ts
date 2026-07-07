import type { ReviewTier } from "./types";
import { DEFAULT_LANGUAGE } from "./language";

// Pure grading logic shared by the server grader and the client's instant
// verdict path. Nothing here may import the Anthropic SDK -- model-dependent
// judgment (synonyms, typo tolerance) lives in grading.ts.

export const NEAR_MISS_MAX_DISTANCE_RATIO = 0.25;

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
 * Grades an answer with no model call. Returns true/false when the outcome
 * is certain, or null when only a model can judge it (a possible synonym on
 * typed recall, a near-miss spelling on cold production). Multiple choice
 * is always certain: options are exact stored strings, so a wrong click can
 * never be "close".
 */
export function gradeDeterministic(
  tier: ReviewTier,
  submitted: string,
  answer: { arabizi: string; english: string }
): boolean | null {
  const a = normalize(submitted);
  if (!a) return false;

  if (tier === "hard") {
    const b = normalize(answer.arabizi);
    if (a === b) return true;
    // The floor is a language knob (see language.ts): romanization spelling
    // variance means short words need a real uncertainty band for the model.
    const nearMissThreshold = Math.max(
      DEFAULT_LANGUAGE.nearMissFloor,
      Math.round(b.length * NEAR_MISS_MAX_DISTANCE_RATIO)
    );
    return levenshtein(a, b) <= nearMissThreshold ? null : false;
  }

  if (englishVariants(answer.english).includes(a)) return true;
  return tier === "easy" ? false : null;
}
