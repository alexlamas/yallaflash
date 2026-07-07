export type ProgressState = "new" | "learning" | "learned";

export interface V2Word {
  id: string;
  language_id: string;
  arabizi: string;
  script: string | null;
  english: string;
  type: string | null;
  memory_hook: string | null;
  etymology_note: string | null;
  etymology_confidence: "confident" | "uncertain" | null;
  notes: string | null;
  pack_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface V2WordProgress {
  word_id: string;
  user_id: string;
  status: ProgressState;
  interval: number;
  ease_factor: number;
  review_count: number;
  next_review_date: string;
  updated_at: string;
}

export type DueWord = V2Word & {
  status: ProgressState;
  interval: number;
  review_count: number;
  next_review_date: string;
  // The user's running note on this word (v2_word_progress.notes), distinct
  // from the word-level notes captured when the word was added.
  user_note: string | null;
};

export interface V2Pack {
  id: string;
  language_id: string;
  name: string;
  description: string | null;
}

export interface V2Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface V2Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  widgets: Widget[];
  created_at: string;
}

// Review tier determines which widget is used to test a word, and caps how
// the answer maps to a rating for calculateNextReview. See docs/v2-plan.md.
export type ReviewTier = "easy" | "medium" | "hard";

// Which side of the word a card asks for. "to_english" (default, and the
// value assumed when absent on older persisted widgets) shows the word and
// asks for the meaning; "to_target" shows the English and asks for the word.
export type ReviewDirection = "to_english" | "to_target";

// An optional sentence wrapped around a review card for variety. On
// recognition cards `target` is shown as-is (its translation is NEVER stored
// here -- it would leak the meaning being tested); on production cards the
// word is blanked out of `target` and `english` is shown as the cue.
export interface ReviewContext {
  target: string;
  english?: string;
}

export interface WordProposal {
  arabizi: string;
  english: string;
  script?: string | null;
  type: string | null;
  notes: string | null;
  memory_hook: string | null;
  // Lettered options for ambiguous fields the model wasn't sure about,
  // e.g. { field: "type", options: { a: "verb", b: "noun" } }
  flagged_assumptions?: { field: string; options: Record<string, string> }[];
}

// The hidden side of a review card, embedded in the widget so the client
// can grade deterministic cases instantly (no server round trip).
export interface ReviewAnswer {
  arabizi: string;
  english: string;
}

// What's shown to the user as the "cue" for a review widget -- only the
// fields relevant to that tier's direction of recall are populated.
export interface ReviewCue {
  arabizi?: string;
  script?: string | null;
  english?: string;
  memory_hook?: string | null;
}

export type Widget =
  | { type: "onboarding_choice" }
  | { type: "pack_list"; packs: V2Pack[] }
  | {
      type: "word_card";
      word: Pick<V2Word, "id" | "arabizi" | "script" | "english" | "memory_hook">;
      image_url?: string | null;
    }
  | {
      type: "quiz_mc";
      word_id: string;
      tier: ReviewTier;
      prompt: string;
      cue: ReviewCue;
      options: string[];
      // Absent means "to_english" (older persisted widgets). "to_target"
      // flips the card: English cue, romanization options.
      direction?: ReviewDirection;
      // Visual theme dealt at build time (see cardFlavors.ts) -- purely
      // presentational; absent renders as the classic look.
      flavor?: string;
      context?: ReviewContext;
      // Ground truth for instant client-side grading -- never shown on the
      // card. Optional: widgets persisted before this field existed lack it,
      // and those fall back to server grading.
      answer?: ReviewAnswer;
    }
  | {
      type: "recall_input";
      word_id: string;
      tier: ReviewTier;
      prompt: string;
      cue: ReviewCue;
      flavor?: string;
      context?: ReviewContext;
      answer?: ReviewAnswer;
    }
  | {
      type: "produce_cold";
      word_id: string;
      tier: ReviewTier;
      prompt: string;
      cue: ReviewCue;
      flavor?: string;
      // On this tier `context.target` arrives with the word already blanked
      // out server-side, and `context.english` is safe to show.
      context?: ReviewContext;
      answer?: ReviewAnswer;
      // Safe on this tier only: the card already shows the English meaning,
      // so a concept image reinforces the cue without leaking the answer.
      // Recognition tiers must never carry one -- the image IS the meaning.
      image_url?: string | null;
    }
  | { type: "add_words_preview"; proposals: WordProposal[] }
  // Zero-due moment: fresh reservoir words (pack words the user hasn't
  // started) offered for selection; confirming inserts progress rows.
  | {
      type: "word_picker";
      candidates: Pick<V2Word, "id" | "arabizi" | "script" | "english" | "type">[];
    }
  // The user-editable slice of the tutor's behavior, shown at onboarding
  // (and whenever the tutor surfaces it). Saving writes v2_user_settings.
  | { type: "instructions_editor"; instructions: string }
  // Receipt for a tutor-initiated data change (regrade, reschedule, edit,
  // delete, note) -- the app renders what actually changed, so mutations
  // are never just prose.
  | {
      type: "data_change";
      action: "regraded" | "rescheduled" | "edited" | "deleted" | "note_saved";
      arabizi: string;
      changes: { field: string; from?: string | null; to?: string | null }[];
    }
  // Client-side only: rendered instantly from the deterministic grade, before
  // (and independent of) the tutor's commentary.
  | {
      type: "review_verdict";
      correct: boolean;
      conceded?: boolean;
      // A hint was used before this answer -- correct, but scheduled as
      // "struggled" rather than a full success.
      hinted?: boolean;
      submitted?: string;
      arabizi: string;
      english: string;
      script: string | null;
      next_review_date: string;
      // From the shared image bank -- attached post-answer, so no leak risk.
      image_url?: string | null;
      // The background SRS write failed: the verdict stands visually but
      // nothing was scheduled -- the word will simply come up again.
      save_failed?: boolean;
    }
  | { type: "session_summary"; reviewed: number; correct: number };
