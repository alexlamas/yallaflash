// Shared fixture data for the design lab. Every variant renders from the same
// two scenarios so the comparison is fair:
//  - "backlog": mirrors the real screenshot state (126 due, retention floored)
//  - "healthy": a user who reviewed this morning
// Time is modeled as relative days (lastReviewedDaysAgo / dueInDays) so the
// lab is deterministic and never touches the real clock.

export type Status = "new" | "learning" | "learned";

export interface LabWord {
  id: string;
  arabizi: string;
  english: string;
  status: Status;
  /** current SRS interval in days */
  interval: number;
  reviewCount: number;
  /** days since last review (drives retention decay) */
  lastReviewedDaysAgo: number;
  /** days until next review; negative = overdue by that many days */
  dueInDays: number;
}

export interface Scenario {
  key: "backlog" | "healthy";
  label: string;
  counts: { new: number; learning: number; learned: number };
  dueNow: number;
  streak: number;
  bestStreak: number;
  reviewedToday: number;
  dailyGoal: number;
  /** reviews per day, oldest first, last entry = today */
  reviewsByDay: number[];
  /** words newly coming due per day for the next 7 days (excludes backlog) */
  incomingByDay: number[];
  words: LabWord[];
}

// Ebbinghaus estimate, same formula as production: R = e^(-t/S).
export function retention(w: LabWord): number | null {
  if (w.reviewCount === 0) return null;
  const stability = Math.max(w.interval, 1 / 24);
  return Math.exp(-w.lastReviewedDaysAgo / stability);
}

/** Words sorted weakest-signal first; unreviewed words go last. */
export function weakestFirst(words: LabWord[]): LabWord[] {
  return [...words].sort((a, b) => {
    const ra = retention(a);
    const rb = retention(b);
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });
}

export function minutesFor(count: number): number {
  return Math.max(1, Math.round(count * 0.4));
}

export const VOCAB_LOOKUP: [string, string][] = [
  ["3am", "present continuous marker"],
  ["zayyan", "decorate"],
  ["jbiin", "forehead"],
  ["daye3", "lost"],
  ["habis", "prison"],
  ["asfar", "yellow"],
  ["mughtarib", "expatriate"],
  ["teerikh", "date / history"],
  ["me2leye", "fried food"],
  ["shu", "what"],
  ["kifak", "how are you"],
  ["yalla", "let's go"],
  ["bukra", "tomorrow"],
  ["shway", "a little"],
  ["ktir", "a lot"],
  ["sohtayn", "bon appétit"],
  ["dala3", "pampering"],
  ["za3lan", "upset"],
  ["mnee7", "good"],
  ["ta3a", "come here"],
  ["ba3dein", "later"],
  ["hallak", "now"],
  ["mbere7", "yesterday"],
  ["jeb", "he brought"],
  ["khalas", "enough / done"],
  ["akid", "for sure"],
  ["ma3le", "never mind"],
  ["sahra", "evening gathering"],
  ["bayt", "house"],
  ["shams", "sun"],
  ["amar", "moon"],
  ["ba7r", "sea"],
  ["jabal", "mountain"],
  ["khebez", "bread"],
  ["zeitoun", "olives"],
  ["ahwe", "coffee"],
  ["mayy", "water"],
  ["sob7iyye", "morning coffee chat"],
  ["layl", "night"],
  ["sa3a", "hour / watch"],
  ["shughl", "work"],
  ["teta", "grandma"],
  ["jiddo", "grandpa"],
  ["kbir", "big"],
  ["zghir", "small"],
  ["jdid", "new"],
  ["helou", "sweet / lovely"],
  ["skhen", "hot"],
  ["berid", "cold"],
  ["3anjad", "really"],
  ["ya3ne", "I mean…"],
  ["bass", "but / only"],
  ["kamen", "also"],
  ["hayda", "this"],
  ["hon", "here"],
  ["badde", "I want"],
  ["fiyye", "I can"],
  ["daghre", "straight ahead"],
  ["3a mahlak", "slow down"],
];

function word(
  i: number,
  status: Status,
  interval: number,
  reviewCount: number,
  lastReviewedDaysAgo: number,
  dueInDays: number
): LabWord {
  const [arabizi, english] = VOCAB_LOOKUP[i % VOCAB_LOOKUP.length];
  return { id: `w${i}`, arabizi, english, status, interval, reviewCount, lastReviewedDaysAgo, dueInDays };
}

// ---------------------------------------------------------------------------
// Backlog: two weeks away. Most words overdue with a *spread* of decay so
// ordering stays meaningful; a few brand-new words wait at the bottom.
// ---------------------------------------------------------------------------
const backlogWords: LabWord[] = [
  word(0, "learning", 1, 3, 16, -15),
  word(1, "learning", 1, 2, 15, -14),
  word(2, "learning", 2, 4, 16, -14),
  word(3, "learning", 2, 3, 14, -12),
  word(4, "learning", 3, 5, 15, -12),
  word(5, "learning", 3, 4, 13, -10),
  word(6, "learning", 4, 6, 14, -10),
  word(7, "learned", 6, 7, 15, -9),
  word(8, "learned", 6, 8, 13, -7),
  word(9, "learned", 8, 9, 14, -6),
  word(10, "learned", 8, 7, 12, -4),
  word(11, "learned", 10, 10, 13, -3),
  word(12, "learned", 12, 11, 14, -2),
  word(13, "learned", 14, 12, 15, -1),
  word(14, "learned", 21, 13, 16, 5),
  word(15, "learned", 30, 14, 15, 15),
  word(16, "learned", 45, 16, 14, 31),
  word(17, "learned", 60, 18, 13, 47),
  word(18, "new", 0, 0, 0, 0),
  word(19, "new", 0, 0, 0, 0),
  word(20, "new", 0, 0, 0, 0),
];

// ---------------------------------------------------------------------------
// Healthy: reviewed this morning, small queue coming due tonight.
// ---------------------------------------------------------------------------
const healthyWords: LabWord[] = [
  word(0, "learning", 1, 3, 1.1, -0.1),
  word(1, "learning", 1, 2, 0.9, 0.1),
  word(2, "learning", 2, 4, 1.6, 0.4),
  word(3, "learning", 3, 5, 1.8, 1.2),
  word(4, "learning", 4, 6, 2.0, 2),
  word(5, "learned", 6, 7, 2.5, 3.5),
  word(6, "learned", 8, 8, 3, 5),
  word(7, "learned", 10, 9, 3, 7),
  word(8, "learned", 12, 10, 4, 8),
  word(9, "learned", 14, 11, 4, 10),
  word(10, "learned", 21, 12, 5, 16),
  word(11, "learned", 30, 13, 6, 24),
  word(12, "learned", 45, 15, 7, 38),
  word(13, "learned", 60, 17, 8, 52),
  word(14, "new", 0, 0, 0, 0),
  word(15, "new", 0, 0, 0, 0),
];

export const SCENARIOS: Record<"backlog" | "healthy", Scenario> = {
  backlog: {
    key: "backlog",
    label: "Backlog (the screenshot: 2 weeks away, 126 due)",
    counts: { new: 35, learning: 37, learned: 128 },
    dueNow: 126,
    streak: 0,
    bestStreak: 21,
    reviewedToday: 0,
    dailyGoal: 10,
    reviewsByDay: [24, 18, 0, 0, 0, 0, 0],
    incomingByDay: [2, 1, 3, 0, 2, 4, 1],
    words: backlogWords,
  },
  healthy: {
    key: "healthy",
    label: "Healthy (reviewed this morning)",
    counts: { new: 35, learning: 37, learned: 128 },
    dueNow: 3,
    streak: 12,
    bestStreak: 21,
    reviewedToday: 7,
    dailyGoal: 10,
    reviewsByDay: [12, 15, 9, 22, 11, 14, 7],
    incomingByDay: [3, 5, 2, 7, 4, 9, 3],
    words: healthyWords,
  },
};

// Milestones tied to real-life ability, not algorithm internals.
export const MILESTONES = [
  { at: 25, title: "Taxi talk", detail: "Directions, greetings, thank-yous" },
  { at: 75, title: "Souk bargaining", detail: "Numbers, colors, 'ktir ghale!'" },
  { at: 150, title: "Kitchen with teta", detail: "Food words and pampering" },
  { at: 250, title: "Sahra survivor", detail: "Hold your own all evening" },
  { at: 400, title: "Mughtarib no more", detail: "Dream in arabizi" },
];

/** total "known" words for milestone math: learned + half-credit for learning */
export function knownWords(s: Scenario): number {
  return s.counts.learned + Math.round(s.counts.learning / 2);
}

// ---------------------------------------------------------------------------
// Shared sampling helpers for the design lab visuals
// ---------------------------------------------------------------------------

function hashStr(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

/** Avalanche mix — plain string hashes give consecutive values for
 * consecutive suffixes, which correlates anything derived from them. */
export function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

export function seeded(seed: string): number {
  return mix(hashStr(seed));
}

export type SampleKind = "strong" | "ok" | "fading" | "asleep";

/** Deterministic sample of word states matching the scenario's proportions. */
export function sampleKinds(data: Scenario, count: number, seed: string): SampleKind[] {
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const started = total - data.counts.new;
  const asleepShare = data.dueNow / Math.max(started, 1);
  return Array.from({ length: count }, (_, i) => {
    const h = seeded(`${data.key}${seed}${i}`);
    const p = (h % 1000) / 1000;
    if (p < asleepShare) return "asleep";
    const s = (h >>> 10) % 100;
    return s > 55 ? "strong" : s > 18 ? "ok" : "fading";
  });
}

/** Distinct vocab entries (no repeats): a seeded shuffle of the whole pool. */
export function sampleVocab(count: number, seed: string): [string, string][] {
  return VOCAB_LOOKUP.map((entry, i) => ({ entry, k: seeded(`${seed}${i}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, Math.min(count, VOCAB_LOOKUP.length))
    .map(({ entry }) => entry);
}
