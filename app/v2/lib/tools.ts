import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
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
// unchanged for any future language.
async function findImageForWord(ctx: ToolContext, english: string): Promise<string | null> {
  const concept = english.toLowerCase().trim();
  if (!concept) return null;

  const { data: exact } = await ctx.supabase
    .from("v2_images")
    .select("url")
    .eq("concept", concept)
    .maybeSingle();
  if (exact) return exact.url;

  const safeConcept = concept.replace(/[,()%_]/g, " ").trim();
  if (!safeConcept) return null;
  const { data: fuzzy } = await ctx.supabase
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
  const imageUrl = await findImageForWord(ctx, data.english);
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

  const existing = progress?.notes?.trim() ?? "";
  const next = mode === "replace" || !existing ? trimmed : `${existing}\n${trimmed}`;

  const { error: writeError } = await ctx.supabase
    .from("v2_word_progress")
    .upsert(
      { user_id: ctx.userId, word_id: wordId, notes: next },
      { onConflict: "user_id,word_id" }
    );
  if (writeError) throw writeError;

  return { result: { word_id: wordId, notes: next } };
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
