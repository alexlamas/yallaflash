import type { ReviewDirection, ReviewTier } from "./types";
import { DEFAULT_LANGUAGE } from "./language";

// Pure grading logic shared by the server grader and the client's instant
// verdict path. Nothing here may import the Anthropic SDK -- model-dependent
// judgment (synonyms, typo tolerance) lives in grading.ts.

// Up to half the collapsed answer may differ before an answer is an instant
// miss. Deliberately wide: a wrong-but-related answer costs one fast model
// check behind the visible "checking" state, which beats flashing a wrong
// verdict that the tutor then overturns in chat.
export const NEAR_MISS_MAX_DISTANCE_RATIO = 0.5;

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Arabizi has no standard orthography: the same spoken word is legitimately
 * written many ways (2/q for qaf-as-hamza, o/u, e/i/y vowels, ch/sh,
 * doubled letters for emphasis). Collapse those equivalences so pure
 * spelling variance compares as equal -- "fisto2"/"fustuq" and
 * "kteer"/"ktir" are the same word, not near-misses. Genuinely different
 * sounds (3, 7 vs h, k vs q's plosive reading) are NOT merged; those still
 * go through the near-miss band to the model.
 */
export function normalizeRomanization(input: string): string {
  return normalize(input)
    .replace(/ch/g, "sh")
    .replace(/q/g, "2")
    .replace(/[éè]/g, "i")
    .replace(/e/g, "i")
    .replace(/y/g, "i")
    .replace(/o/g, "u")
    .replace(/(.)\1+/g, "$1")
    .replace(/[\s-]+/g, " ");
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
  answer: { arabizi: string; english: string },
  direction: ReviewDirection = "to_english"
): boolean | null {
  const a = normalize(submitted);
  if (!a) return false;

  // Reversed multiple choice (English shown, word options): options are the
  // stored strings, so the click either matches the word or it doesn't --
  // never a near-miss, never a model call.
  if (direction === "to_target" && tier !== "hard") {
    return normalizeRomanization(submitted) === normalizeRomanization(answer.arabizi);
  }

  if (tier === "hard") {
    const b = normalize(answer.arabizi);
    if (a === b) return true;
    // Same word under romanization equivalences = correct, not a near-miss:
    // the user knows the word, they just spell it differently.
    const ar = normalizeRomanization(submitted);
    const br = normalizeRomanization(answer.arabizi);
    if (ar === br) return true;
    // The floor is a language knob (see language.ts): romanization spelling
    // variance means short words need a real uncertainty band for the model.
    // Distance is measured on the equivalence-collapsed forms so vowel
    // spelling never eats into the typo budget.
    const nearMissThreshold = Math.max(
      DEFAULT_LANGUAGE.nearMissFloor,
      Math.round(br.length * NEAR_MISS_MAX_DISTANCE_RATIO)
    );
    return levenshtein(ar, br) <= nearMissThreshold ? null : false;
  }

  if (englishVariants(answer.english).includes(a)) return true;
  return tier === "easy" ? false : null;
}
