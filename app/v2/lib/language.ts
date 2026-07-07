// Per-language presentation and grading knobs. The DB (v2_languages) owns
// which languages exist; this map owns how each one reads in the UI, card
// prompts, grading prompts, and the tutor's language-specific coaching.
// Adding a language = one entry here + a seed row in v2_languages.

export interface LanguageSpec {
  /** Matches v2_languages.code */
  code: string;
  /** "Lebanese Arabic" -- used in grading prompts and tutor framing */
  name: string;
  /** What the latin-letter field is called in UI and prompts: "arabizi" */
  romanization: string;
  /** Native-script writing direction */
  scriptDir: "rtl" | "ltr";
  /** Placeholder for the cold-production answer input */
  producePlaceholder: string;
  /**
   * Near-miss floor for deterministic grading: minimum edit distance treated
   * as "maybe a typo, let the model judge". Arabizi vowel spellings vary
   * wildly (kteer/ktir), so short words need a real uncertainty band.
   */
  nearMissFloor: number;
  /** Language-specific slice of the tutor system prompt (dialect, romanization rules) */
  promptSection: string;
}

const LEBANESE_ARABIC: LanguageSpec = {
  code: "leb-ar",
  name: "Lebanese Arabic",
  romanization: "arabizi",
  scriptDir: "rtl",
  producePlaceholder: "Arabizi, from memory...",
  nearMissFloor: 2,
  promptSection: `DIALECT
Everything is Lebanese/Levantine colloquial, not MSA (fus7a). When a word differs between Lebanese and MSA, give the Lebanese form as primary and note the MSA form only as a labelled aside. Examples, conjugations, and phrasing should all sound like spoken Lebanese.

ARABIZI
The arabizi field is stored and shown exactly as the user typed it -- never silently "correct" or normalize it. Numerals are standard (2 = hamza/qaf, 3 = ayn, 7 = ha).`,
};

const SPECS: Record<string, LanguageSpec> = {
  [LEBANESE_ARABIC.code]: LEBANESE_ARABIC,
};

// The app currently teaches one language; widgets don't carry language_id
// yet, so client components read the default spec. When a second language
// ships, thread the code through ToolContext/widgets and resolve per word.
export const DEFAULT_LANGUAGE = LEBANESE_ARABIC;

export function specForCode(code: string): LanguageSpec {
  return SPECS[code] ?? DEFAULT_LANGUAGE;
}
