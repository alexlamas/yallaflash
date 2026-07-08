// A stored english often carries a usage example that includes the word
// itself -- "mind / attention (as in 'khalli belak' = pay attention)" for
// "bel". Rendered on a card, that hands the answer over: on a recognition
// card the option containing the cue word is obviously the right one, and on
// a production card the example spells out the word being asked for. These
// helpers strip the tell while keeping the text gradeable.

// Tokens of the word worth scanning for: the full arabizi plus each word of
// it long enough to be distinctive. Short particles ("w", "el") would flag
// half the dictionary.
function leakTokens(arabizi: string): string[] {
  const tokens = arabizi
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((token) => token.length >= 3);
  const full = arabizi.toLowerCase().trim();
  return full.length >= 3 ? [full, ...tokens] : tokens;
}

// Inflected forms keep the stem as a prefix (bel -> belak), so a leak is
// "some word in the text STARTS WITH a token" -- plain containment would
// false-positive on English words that merely embed the letters ("banana"
// contains "ana").
export function leaksWord(text: string, arabizi: string): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9']+/);
  return leakTokens(arabizi).some((token) => words.some((word) => word.startsWith(token)));
}

export function leakFreeEnglish(english: string, arabizi: string): string {
  if (!leaksWord(english, arabizi)) return english;
  // Parenthetical asides are where the example almost always lives. Drop
  // them ALL (not just the leaky one) so the cleaned text lines up with
  // englishVariants' parens-free variant and multiple-choice clicks on it
  // still grade as exact matches.
  let cleaned = english.replace(/\s*\([^)]*\)/g, " ");
  // A leak in the prose itself: blank the word out rather than reveal it.
  for (const token of leakTokens(arabizi)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}[a-z0-9']*`, "gi"), "...");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned || english;
}
