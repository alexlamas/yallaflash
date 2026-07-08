import type { ReviewTier } from "./types";

// The numbered word ladder. Every word sits on a level computed from its own
// SRS state, and the level -- not chance -- decides which test format it
// gets. One rung per kind of knowledge, easiest first:
//
//   0  quiz_mc (to_english)   brand new: recognize the meaning among options
//   1  quiz_mc (to_target)    reversed: pick the word for the shown English
//   2  word_builder           assemble the word from its own scrambled tiles
//   3  recall_input           type the meaning, no options
//   4  produce_cold           type the word from memory
//   5  produce_cold           long-interval maintenance; context sentences
//                             (fill-in-the-blank) land here most naturally
//
// Climbing is driven by the SRS state the answers themselves write: levels
// 0-2 grade as the "easy" tier, so a word can't reach "learned" without
// passing typed recall (level 3+). A learned word that later fails drops to
// "learning" and re-enters at level 3 -- one rung down, not back to the start.
export type WordLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const MAX_WORD_LEVEL: WordLevel = 5;

export interface LevelProgress {
  status: string;
  review_count: number;
  // Days between reviews (SM-2). Splits long-established learned words
  // (level 5) from freshly learned ones (level 4).
  interval?: number | null;
}

export function levelForProgress(progress: LevelProgress | null): WordLevel {
  if (!progress || progress.status === "new" || progress.review_count === 0) return 0;
  if (progress.status === "learning") {
    if (progress.review_count === 1) return 1;
    if (progress.review_count === 2) return 2;
    return 3;
  }
  // Learned: a week's interval is the line between "just graduated" and
  // "established" -- established words get the hardest, most contextual form.
  return (progress.interval ?? 0) < 7 ? 4 : 5;
}

// The coarse grading bucket a level maps to. The tier still owns grading
// semantics (what counts as a pass, the rating cap, whether "learned" can be
// earned) and rides on every persisted widget -- the level owns which test
// format is built.
export function tierForLevel(level: WordLevel): ReviewTier {
  if (level <= 2) return "easy";
  if (level === 3) return "medium";
  return "hard";
}

// One number for the whole collection: how far up the ladder it sits on
// average. 0% = everything brand new, 100% = every word at the summit.
// Shared by the progress panel and the mobile bar so the app never shows
// two different "percents".
export function climbPercent(words: LevelProgress[]): number {
  if (words.length === 0) return 0;
  const sum = words.reduce((acc, word) => acc + levelForProgress(word), 0);
  return Math.round((sum / (words.length * MAX_WORD_LEVEL)) * 100);
}
