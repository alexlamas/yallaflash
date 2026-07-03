import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateNextReview } from "@/app/services/spacedRepetitionService";
import type { DueWord, ReviewCue, ReviewTier, Widget, WordProposal } from "./types";

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  languageId: string;
}

export async function getDefaultLanguageId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.from("v2_languages").select("id").eq("code", "leb-ar").single();
  if (error || !data) {
    throw new Error("Lebanese Arabic language row not found -- run the v2 seed migration");
  }
  return data.id;
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_due_words",
    description:
      "Get the user's words due for review right now (includes brand-new words that haven't been tested yet), ordered most-overdue first.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max words to return, default 10" },
      },
    },
  },
  {
    name: "search_words",
    description: "Search the user's vocabulary (own words and pack words) by arabizi or English meaning.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_word_detail",
    description: "Get full detail for a single word by id.",
    input_schema: {
      type: "object",
      properties: { word_id: { type: "string" } },
      required: ["word_id"],
    },
  },
  {
    name: "start_review",
    description:
      "Given a specific due word you've decided to test next, deterministically build the review widget for it. The app picks the difficulty tier from the word's own progress -- you only choose which due word to test.",
    input_schema: {
      type: "object",
      properties: { word_id: { type: "string" } },
      required: ["word_id"],
    },
  },
  {
    name: "search_images",
    description:
      "Search the shared image bank by concept (an English term, e.g. 'water', 'greetings'). Images are language-agnostic illustrations you can reference when presenting words. Returns matching concepts and URLs.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "update_word_note",
    description:
      "Save or update your running note on a word -- the user's personal context: where they encountered it, who says it, usage nuances, corrections, mnemonics that clicked, related words. Notes persist across sessions and come back in get_due_words and get_word_detail. By default the note is appended to what's already there; use mode 'replace' to rewrite the whole note (e.g. tidying it up).",
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string" },
        note: { type: "string", description: "Telegraphic -- a line or two, not prose" },
        mode: { type: "string", enum: ["append", "replace"], description: "Default append" },
      },
      required: ["word_id", "note"],
    },
  },
  {
    name: "regrade_review",
    description:
      "Overturn the most recent grade on a word when the user contests it and their case is fair (e.g. an accepted alternate spelling was marked wrong). Recomputes the schedule deterministically from the word's current SRS state with the corrected outcome. Say plainly what you changed. Never regrade unprompted.",
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string" },
        correct: { type: "boolean", description: "The corrected outcome" },
      },
      required: ["word_id", "correct"],
    },
  },
  {
    name: "reschedule_word",
    description:
      "Set when a word comes up next -- 'test me on this tomorrow', 'push this back a week', or 0 hours to make it due right now (a boost). The SRS state is otherwise untouched.",
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string" },
        hours_from_now: { type: "number", description: "0 = due immediately" },
      },
      required: ["word_id", "hours_from_now"],
    },
  },
  {
    name: "update_word",
    description:
      "Edit a word the user owns (their custom words): fix arabizi spelling, script, english, type, or memory_hook. Shared pack words can't be edited -- offer to save context in the word's note instead. Confirm the exact change with the user before calling unless they've already spelled it out.",
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string" },
        arabizi: { type: "string" },
        script: { type: "string" },
        english: { type: "string" },
        type: { type: "string" },
        memory_hook: { type: "string" },
      },
      required: ["word_id"],
    },
  },
  {
    name: "delete_word",
    description:
      "Stop learning a word: removes it from the user's review queue (and deletes the word entirely if it's their own custom word). Destructive -- only call after the user has clearly asked for or agreed to the removal in this conversation.",
    input_schema: {
      type: "object",
      properties: { word_id: { type: "string" } },
      required: ["word_id"],
    },
  },
  {
    name: "propose_words",
    description:
      "Stage parsed vocabulary as a preview widget for the user to confirm. Does not write to the database -- confirmation happens outside you.",
    input_schema: {
      type: "object",
      properties: {
        proposals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              arabizi: { type: "string", description: "Exactly as the user typed it" },
              english: { type: "string" },
              script: { type: "string", description: "Arabic script, only if confident" },
              type: { type: "string" },
              notes: { type: "string" },
              memory_hook: { type: "string" },
              flagged_assumptions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    options: { type: "object" },
                  },
                },
              },
            },
            required: ["arabizi", "english"],
          },
        },
      },
      required: ["proposals"],
    },
  },
];

export async function executeTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<{ result: unknown; widget?: Widget }> {
  switch (name) {
    case "get_due_words":
      return getDueWords(ctx, typeof input.limit === "number" ? input.limit : 10);
    case "search_words":
      return searchWords(ctx, String(input.query ?? ""));
    case "search_images":
      return searchImages(ctx, String(input.query ?? ""));
    case "get_word_detail":
      return getWordDetail(ctx, String(input.word_id ?? ""));
    case "start_review":
      return startReview(ctx, String(input.word_id ?? ""));
    case "update_word_note":
      return updateWordNote(
        ctx,
        String(input.word_id ?? ""),
        String(input.note ?? ""),
        input.mode === "replace" ? "replace" : "append"
      );
    case "regrade_review":
      return regradeReview(ctx, String(input.word_id ?? ""), Boolean(input.correct));
    case "reschedule_word":
      return rescheduleWord(ctx, String(input.word_id ?? ""), Number(input.hours_from_now ?? 0));
    case "update_word":
      return updateWord(ctx, String(input.word_id ?? ""), input);
    case "delete_word":
      return deleteWord(ctx, String(input.word_id ?? ""));
    case "propose_words":
      return proposeWords(input.proposals as WordProposal[]);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function getDueWords(ctx: ToolContext, limit: number) {
  const { data, error } = await ctx.supabase
    .from("v2_word_progress")
    // "*" (not explicit columns) so the notes column being absent -- the
    // 20260702 migration not applied yet -- degrades to user_note: null
    // instead of a query error.
    .select("*, v2_words!inner(*)")
    .eq("user_id", ctx.userId)
    .lte("next_review_date", new Date().toISOString())
    .order("next_review_date", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const words: DueWord[] = (data ?? []).map((row) => {
    const word = row.v2_words as unknown as DueWord;
    return {
      ...word,
      status: row.status,
      interval: row.interval,
      review_count: row.review_count,
      next_review_date: row.next_review_date,
      user_note: (row as { notes?: string | null }).notes ?? null,
    };
  });

  return { result: words };
}

async function searchWords(ctx: ToolContext, query: string) {
  const safeQuery = query.replace(/[,()%_]/g, " ").trim();
  if (!safeQuery) return { result: [] };

  const { data, error } = await ctx.supabase
    .from("v2_words")
    .select("*")
    .eq("language_id", ctx.languageId)
    .or(`arabizi.ilike.%${safeQuery}%,english.ilike.%${safeQuery}%`)
    .limit(10);

  if (error) throw error;
  return { result: data ?? [] };
}

async function searchImages(ctx: ToolContext, query: string) {
  const safeQuery = query.replace(/[,()%_]/g, " ").trim();
  if (!safeQuery) return { result: [] };

  const { data, error } = await ctx.supabase
    .from("v2_images")
    .select("id, concept, url")
    .ilike("concept", `%${safeQuery}%`)
    .limit(10);

  if (error) throw error;
  return { result: data ?? [] };
}

// Best-effort concept match for a word: exact concept first, then substring.
// The bank is language-agnostic (keyed by English concept), so this works
// unchanged for any future language. Exported for the review-answer route,
// which attaches an image to verdict cards (post-answer, so no leak risk).
export async function findImageForWord(supabase: SupabaseClient, english: string): Promise<string | null> {
  const concept = english.toLowerCase().trim();
  if (!concept) return null;

  const { data: exact } = await supabase
    .from("v2_images")
    .select("url")
    .eq("concept", concept)
    .maybeSingle();
  if (exact) return exact.url;

  const safeConcept = concept.replace(/[,()%_]/g, " ").trim();
  if (!safeConcept) return null;
  const { data: fuzzy } = await supabase
    .from("v2_images")
    .select("url")
    .ilike("concept", `%${safeConcept}%`)
    .limit(1)
    .maybeSingle();
  return fuzzy?.url ?? null;
}

async function getWordDetail(ctx: ToolContext, wordId: string): Promise<{ result: unknown; widget?: Widget }> {
  const { data, error } = await ctx.supabase.from("v2_words").select("*").eq("id", wordId).maybeSingle();
  if (error) throw error;
  if (!data) return { result: null };
  // "*" so a not-yet-migrated notes column degrades to null, not an error.
  const { data: progress } = await ctx.supabase
    .from("v2_word_progress")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId)
    .maybeSingle();
  const imageUrl = await findImageForWord(ctx.supabase, data.english);
  return {
    result: { ...data, user_note: progress?.notes ?? null },
    widget: {
      type: "word_card",
      word: { id: data.id, arabizi: data.arabizi, script: data.script, english: data.english, memory_hook: data.memory_hook },
      image_url: imageUrl,
    },
  };
}

export function tierForProgress(progress: { status: string; review_count: number } | null): ReviewTier {
  if (!progress || progress.status === "new" || progress.review_count === 0) return "easy";
  if (progress.status === "learning") return "medium";
  return "hard";
}

async function startReview(ctx: ToolContext, wordId: string): Promise<{ result: unknown; widget?: Widget }> {
  const { data: progress, error: progressError } = await ctx.supabase
    .from("v2_word_progress")
    .select("status, review_count")
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId)
    .maybeSingle();
  if (progressError) throw progressError;

  const { data: word, error: wordError } = await ctx.supabase
    .from("v2_words")
    .select("*")
    .eq("id", wordId)
    .single();
  if (wordError) throw wordError;

  const tier = tierForProgress(progress);

  const widget = await buildReviewWidget(ctx, word, tier);
  // Tell the model exactly what the card displays and what must stay hidden,
  // so its lead-in text can't leak the answer (e.g. framing a recognition
  // card as "how do you say 'a lot'?" gives the meaning away).
  const isProduction = tier === "hard";
  return {
    result: {
      tier,
      card_shows: isProduction
        ? { english: word.english, memory_hook: word.memory_hook }
        : { arabizi: word.arabizi, script: word.script },
      card_asks_user_for: isProduction ? "the arabizi, typed from memory" : "the English meaning",
      do_not_reveal_in_your_text: isProduction
        ? `the arabizi "${word.arabizi}" or its script`
        : `the English meaning "${word.english}"`,
    },
    widget,
  };
}

export async function buildReviewWidget(
  ctx: ToolContext,
  word: { id: string; language_id: string; arabizi: string; script: string | null; english: string; memory_hook: string | null },
  tier: ReviewTier
): Promise<Widget> {
  // Ground truth rides along (not rendered on the card) so the client can
  // grade exact matches instantly instead of waiting on a round trip.
  const answer = { arabizi: word.arabizi, english: word.english };

  if (tier === "hard") {
    const cue: ReviewCue = { english: word.english, memory_hook: word.memory_hook };
    return {
      type: "produce_cold",
      word_id: word.id,
      tier,
      prompt: `Type the arabizi for "${word.english}" -- no options, from memory.`,
      cue,
      answer,
    };
  }

  const cue: ReviewCue = { arabizi: word.arabizi, script: word.script };

  if (tier === "medium") {
    return {
      type: "recall_input",
      word_id: word.id,
      tier,
      prompt: `What does "${word.arabizi}" mean?`,
      cue,
      answer,
    };
  }

  const distractors = await getDistractors(ctx, word);
  return {
    type: "quiz_mc",
    word_id: word.id,
    tier,
    prompt: `What does "${word.arabizi}" mean?`,
    cue,
    options: shuffle([word.english, ...distractors]),
    answer,
  };
}

async function getDistractors(ctx: ToolContext, word: { id: string; language_id: string; english: string }) {
  const { data } = await ctx.supabase
    .from("v2_words")
    .select("english")
    .eq("language_id", word.language_id)
    .neq("id", word.id)
    .limit(20);

  const pool = Array.from(new Set((data ?? []).map((w) => w.english))).filter(
    (e) => e.toLowerCase() !== word.english.toLowerCase()
  );
  return shuffle(pool).slice(0, 3);
}

// Writes to v2_word_progress.notes (per-user), not v2_words.notes -- pack
// words are shared rows the user can't update, and the note is the user's
// relationship with the word anyway. All other progress columns have
// defaults, so the upsert also covers words with no progress row yet.
async function updateWordNote(
  ctx: ToolContext,
  wordId: string,
  note: string,
  mode: "append" | "replace"
) {
  const trimmed = note.trim();
  if (!wordId || !trimmed) {
    return { result: { error: "word_id and a non-empty note are required" } };
  }

  const { data: progress, error: readError } = await ctx.supabase
    .from("v2_word_progress")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId)
    .maybeSingle();
  if (readError) throw readError;

  const existing = (progress as { notes?: string | null } | null)?.notes?.trim() ?? "";
  const next = mode === "replace" || !existing ? trimmed : `${existing}\n${trimmed}`;

  const { error: writeError } = await ctx.supabase
    .from("v2_word_progress")
    .upsert(
      { user_id: ctx.userId, word_id: wordId, notes: next },
      { onConflict: "user_id,word_id" }
    );
  if (!writeError) {
    return { result: { word_id: wordId, notes: next } };
  }

  // The notes column migration may not be applied yet (PostgREST rejects the
  // unknown column). Fall back to word-level notes for user-owned words so
  // the habit keeps working; pack words genuinely need the migration.
  const columnMissing =
    (writeError as { code?: string }).code === "PGRST204" || /notes/i.test(writeError.message ?? "");
  if (!columnMissing) throw writeError;

  const { data: word } = await ctx.supabase
    .from("v2_words")
    .select("user_id, notes")
    .eq("id", wordId)
    .maybeSingle();
  if (word?.user_id === ctx.userId) {
    const wordExisting = word.notes?.trim() ?? "";
    const merged = mode === "replace" || !wordExisting ? trimmed : `${wordExisting}\n${trimmed}`;
    const { error: fallbackError } = await ctx.supabase
      .from("v2_words")
      .update({ notes: merged })
      .eq("id", wordId);
    if (fallbackError) throw fallbackError;
    return {
      result: {
        word_id: wordId,
        notes: merged,
        stored_on: "the word itself (progress-notes migration not applied yet)",
      },
    };
  }
  return {
    result: {
      error:
        "Can't save notes on shared pack words until the v2_word_progress.notes migration runs (supabase/migrations/20260702_v2_word_notes.sql). Tell the user their note will stick once that's applied.",
    },
  };
}

// Overturns the latest grade: recomputes the schedule from the word's
// current SRS state with the corrected outcome. The math stays in
// calculateNextReview -- the model only decides THAT a correction is fair,
// never what the schedule becomes. review_count is not re-incremented
// (it's a correction, not a new review).
async function regradeReview(ctx: ToolContext, wordId: string, correct: boolean) {
  const { data: progress, error: progressError } = await ctx.supabase
    .from("v2_word_progress")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId)
    .maybeSingle();
  if (progressError) throw progressError;
  if (!progress) return { result: { error: "No progress found for that word." } };

  const { data: word } = await ctx.supabase
    .from("v2_words")
    .select("arabizi")
    .eq("id", wordId)
    .maybeSingle();

  const tier = tierForProgress({ status: progress.status, review_count: progress.review_count });
  const rating = !correct ? 0 : tier === "hard" ? 3 : 2;
  const { interval, easeFactor, nextReviewDate } = calculateNextReview(
    progress.interval ?? 0,
    progress.ease_factor ?? 2.5,
    rating,
    progress.review_count ?? 0
  );

  const { error: updateError } = await ctx.supabase
    .from("v2_word_progress")
    .update({
      status: rating >= 2 ? "learned" : "learning",
      interval,
      ease_factor: easeFactor,
      next_review_date: nextReviewDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId);
  if (updateError) throw updateError;

  return {
    result: {
      word_id: wordId,
      arabizi: word?.arabizi,
      regraded_as: correct ? "correct" : "incorrect",
      next_review_date: nextReviewDate.toISOString(),
    },
  };
}

async function rescheduleWord(ctx: ToolContext, wordId: string, hoursFromNow: number) {
  const hours = Number.isFinite(hoursFromNow) ? Math.max(0, hoursFromNow) : 0;
  const nextReview = new Date(Date.now() + hours * 3600_000).toISOString();
  const { error, count } = await ctx.supabase
    .from("v2_word_progress")
    .update({ next_review_date: nextReview, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId);
  if (error) throw error;
  if (!count) return { result: { error: "No progress found for that word." } };
  return { result: { word_id: wordId, next_review_date: nextReview } };
}

const EDITABLE_WORD_FIELDS = ["arabizi", "script", "english", "type", "memory_hook"] as const;

async function updateWord(ctx: ToolContext, wordId: string, input: Record<string, unknown>) {
  const { data: word, error: readError } = await ctx.supabase
    .from("v2_words")
    .select("user_id, pack_id")
    .eq("id", wordId)
    .maybeSingle();
  if (readError) throw readError;
  if (!word) return { result: { error: "Word not found." } };
  if (word.user_id !== ctx.userId || word.pack_id !== null) {
    return {
      result: {
        error:
          "That's a shared pack word -- it can't be edited. Offer to save the correction in the word's note, or add the user's own version instead.",
      },
    };
  }

  const patch: Record<string, string> = {};
  for (const field of EDITABLE_WORD_FIELDS) {
    if (typeof input[field] === "string" && (input[field] as string).trim()) {
      patch[field] = (input[field] as string).trim();
    }
  }
  if (Object.keys(patch).length === 0) {
    return { result: { error: "No editable fields given (arabizi, script, english, type, memory_hook)." } };
  }

  const { error: updateError } = await ctx.supabase.from("v2_words").update(patch).eq("id", wordId);
  if (updateError) throw updateError;
  return { result: { word_id: wordId, updated: patch } };
}

async function deleteWord(ctx: ToolContext, wordId: string) {
  const { data: word, error: readError } = await ctx.supabase
    .from("v2_words")
    .select("arabizi, user_id, pack_id")
    .eq("id", wordId)
    .maybeSingle();
  if (readError) throw readError;
  if (!word) return { result: { error: "Word not found." } };

  const { error: progressError } = await ctx.supabase
    .from("v2_word_progress")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId);
  if (progressError) throw progressError;

  // Their own custom word disappears entirely; a pack word just leaves
  // their queue and stays in the reservoir.
  let wordDeleted = false;
  if (word.user_id === ctx.userId && word.pack_id === null) {
    const { error: deleteError } = await ctx.supabase.from("v2_words").delete().eq("id", wordId);
    if (deleteError) throw deleteError;
    wordDeleted = true;
  }

  return {
    result: {
      word_id: wordId,
      arabizi: word.arabizi,
      removed_from_queue: true,
      word_deleted: wordDeleted,
    },
  };
}

function proposeWords(proposals: WordProposal[]): { result: unknown; widget?: Widget } {
  // An empty call must not surface a "0 words to add" widget to the user.
  if (!Array.isArray(proposals) || proposals.length === 0) {
    return { result: { error: "No proposals given -- nothing was staged." } };
  }
  return {
    result: { staged: proposals.length },
    widget: { type: "add_words_preview", proposals },
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
