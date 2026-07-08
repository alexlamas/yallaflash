import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateNextReview } from "@/app/services/spacedRepetitionService";
import type { DueWord, ReviewContext, ReviewCue, Widget, WordProposal } from "./types";
import { DEFAULT_LANGUAGE } from "./language";
import { flavorForWord } from "./cardFlavors";
import { leakFreeEnglish, leaksWord } from "./leakGuard";
import { buildTiles } from "./tiles";
import { levelForProgress, tierForLevel, type WordLevel } from "./levels";

export interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
  languageId: string;
}

export async function getDefaultLanguageId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("v2_languages")
    .select("id")
    .eq("code", DEFAULT_LANGUAGE.code)
    .single();
  if (error || !data) {
    throw new Error(`${DEFAULT_LANGUAGE.name} language row not found -- run the v2 seed migration`);
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
      "Given a specific due word you've decided to test next, deterministically build the review widget for it. The app computes the word's numbered level (0-5) from its own progress and that level decides the test format (recognition choice -> reversed choice -> tile builder -> typed recall -> cold production) -- you choose which due word to test, and can optionally wrap it in a sentence for variety.",
    input_schema: {
      type: "object",
      properties: {
        word_id: { type: "string" },
        context_sentence: {
          type: "object",
          description: `Optional, for variety: a short natural ${DEFAULT_LANGUAGE.name} sentence that uses this word exactly as stored. Recognition cards show the sentence as context (its translation stays hidden); production cards blank the word out and show the translation, becoming a fill-in-the-blank. Ignored if the sentence doesn't contain the word's stored ${DEFAULT_LANGUAGE.romanization}.`,
          properties: {
            target: {
              type: "string",
              description: `The sentence in ${DEFAULT_LANGUAGE.romanization}, containing the word's stored spelling verbatim`,
            },
            english: { type: "string", description: "The sentence's English translation" },
          },
          required: ["target", "english"],
        },
      },
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
    name: "update_instructions",
    description:
      "Rewrite the user's standing instructions (the user-visible slice of how you coach, shown at the end of your system prompt). Pass the COMPLETE new instructions -- keep everything the user didn't ask to change. Use for lasting behavior changes only, not one-off requests.",
    input_schema: {
      type: "object",
      properties: {
        instructions: { type: "string", description: "The full replacement instructions" },
      },
      required: ["instructions"],
    },
  },
  {
    name: "list_all_words",
    description:
      "The user's ENTIRE vocabulary with SRS state -- use for whole-collection jobs: deduping, auditing, bulk cleanup, 'what am I learning?'. Personal scale, fits comfortably in context.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "delete_words",
    description:
      "Stop learning one or more words: removes them from the user's review queue (words they own are deleted entirely; pack words stay in the shared reservoir). Destructive -- state the exact list first and only call after the user clearly agrees in this conversation. For cleanup jobs like deduping: list_all_words, propose the exact removals, get a yes, then one delete_words call.",
    input_schema: {
      type: "object",
      properties: {
        word_ids: { type: "array", items: { type: "string" } },
      },
      required: ["word_ids"],
    },
  },
  {
    name: "suggest_chips",
    description:
      'Offer up to 3 quick-reply chips above the chat input for the likeliest next actions -- use when the obvious next step is not covered by the standard buttons (e.g. after deleting the word whose card was on the table, offer "Next word"). label is what the user sees; send is the message a tap sends. Use send "next" to serve the next due card directly.',
    input_schema: {
      type: "object",
      properties: {
        chips: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short button text, 1-3 words" },
              send: { type: "string", description: 'The message tapping it sends ("next" serves the next card)' },
            },
            required: ["label", "send"],
          },
        },
      },
      required: ["chips"],
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
      return startReview(
        ctx,
        String(input.word_id ?? ""),
        (input.context_sentence ?? undefined) as ContextSentenceInput | undefined
      );
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
    case "list_all_words":
      return listAllWords(ctx);
    case "delete_words":
      return deleteWords(ctx, Array.isArray(input.word_ids) ? input.word_ids.map(String) : []);
    case "update_instructions":
      return updateInstructions(ctx, String(input.instructions ?? ""));
    case "propose_words":
      return proposeWords(input.proposals as WordProposal[]);
    case "suggest_chips":
      return suggestChips(input.chips);
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

// Which test format a level gets is fixed in buildReviewWidget; this is the
// grading bucket that rides on the widget. Re-exported so route code can
// stay on one import.
export { levelForProgress, tierForLevel } from "./levels";

// A model-supplied sentence for start_review. Validated server-side before
// it reaches a card: it must actually contain the word, and its translation
// is only ever kept on production tiers (on recognition it would hand over
// the meaning being tested).
export interface ContextSentenceInput {
  target?: string;
  english?: string;
}

function wordPattern(word: string): RegExp {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function usableSentence(
  input: ContextSentenceInput | undefined,
  arabizi: string
): { target: string; english?: string } | null {
  const target = typeof input?.target === "string" ? input.target.trim() : "";
  if (!target || !wordPattern(arabizi).test(target)) return null;
  const english = typeof input?.english === "string" ? input.english.trim() : "";
  return { target, english: english || undefined };
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// "Slipping" for the card's color: badly overdue -- two days is well past
// any early-rung interval and a real slice of a long one.
export function isSlipping(nextReviewDate: string | null | undefined): boolean {
  if (!nextReviewDate) return false;
  return Date.now() - new Date(nextReviewDate).getTime() > 2 * 24 * 3600_000;
}

type ReviewCardWidget = Extract<
  Widget,
  { type: "quiz_mc" | "recall_input" | "produce_cold" | "word_builder" }
>;

// Which side a card keeps hidden until the user answers. Production cards,
// tile builders, and reversed multiple choice hide the word; everything
// else hides the English meaning.
export function cardAsksForTarget(widget: ReviewCardWidget): boolean {
  return (
    widget.type === "produce_cold" ||
    widget.type === "word_builder" ||
    (widget.type === "quiz_mc" && widget.direction === "to_target")
  );
}

// The hidden ground-truth line persisted when the app serves a card without
// the model. Shared by both serve paths so the `asks=` token (which the
// chat route's leak scrub reads) can never drift from the widget.
export function buildServedLine(
  word: { id: string; arabizi: string; english: string },
  widget: ReviewCardWidget
): string {
  const asksTarget = cardAsksForTarget(widget);
  const asks = asksTarget
    ? widget.type === "quiz_mc"
      ? `the right ${DEFAULT_LANGUAGE.romanization} option for the shown English`
      : widget.type === "word_builder"
      ? `the ${DEFAULT_LANGUAGE.romanization}, assembled from its own scrambled tiles`
      : widget.context
      ? `the ${DEFAULT_LANGUAGE.romanization} missing from a sentence`
      : `the ${DEFAULT_LANGUAGE.romanization} from memory`
    : "context" in widget && widget.context
    ? `the English meaning -- the word is shown inside a ${DEFAULT_LANGUAGE.name} sentence for context`
    : "the English meaning";
  return `[SERVED] word_id=${word.id} arabizi="${word.arabizi}" english="${word.english}"${widget.level !== undefined ? ` level=${widget.level}` : ""} tier=${widget.tier} asks=${asksTarget ? "arabizi" : "english"} -- the app served this card directly; the user hasn't answered yet. The card asks for ${asks}.`;
}

async function startReview(
  ctx: ToolContext,
  wordId: string,
  contextSentence?: ContextSentenceInput
): Promise<{ result: unknown; widget?: Widget }> {
  const { data: progress, error: progressError } = await ctx.supabase
    .from("v2_word_progress")
    .select("status, review_count, interval, next_review_date")
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

  const level = levelForProgress(progress);

  const widget = (await buildReviewWidget(
    ctx,
    word,
    level,
    contextSentence,
    isSlipping(progress?.next_review_date)
  )) as ReviewCardWidget;
  // Tell the model exactly what the card displays and what must stay hidden,
  // so its lead-in text can't leak the answer (e.g. framing a recognition
  // card as "how do you say 'a lot'?" gives the meaning away). Derived from
  // the built widget, not the tier: format is shuffled per card.
  const asksTarget = cardAsksForTarget(widget);
  const context = widget.type === "word_builder" ? undefined : widget.context;
  return {
    result: {
      level,
      tier: widget.tier,
      format:
        widget.type === "quiz_mc"
          ? asksTarget
            ? `multiple choice, reversed: English shown, ${DEFAULT_LANGUAGE.romanization} options`
            : "multiple choice"
          : widget.type === "recall_input"
          ? "typed meaning"
          : widget.type === "word_builder"
          ? `tile builder: English shown, the ${DEFAULT_LANGUAGE.romanization} assembled from its own scrambled tiles`
          : context
          ? "fill-in-the-blank sentence"
          : `typed ${DEFAULT_LANGUAGE.romanization} from memory`,
      card_shows: asksTarget
        ? {
            english: word.english,
            memory_hook: word.memory_hook,
            ...(widget.type === "word_builder" ? { scrambled_tiles: widget.tiles } : {}),
            ...(context ? { sentence_with_blank: context.target, sentence_english: context.english } : {}),
          }
        : {
            arabizi: word.arabizi,
            script: word.script,
            ...(context ? { context_sentence: context.target } : {}),
          },
      card_asks_user_for: asksTarget
        ? widget.type === "quiz_mc"
          ? `picking the right ${DEFAULT_LANGUAGE.romanization} option`
          : widget.type === "word_builder"
          ? "assembling the word from the tiles"
          : `the ${DEFAULT_LANGUAGE.romanization}, typed from memory`
        : "the English meaning",
      do_not_reveal_in_your_text: asksTarget
        ? `the ${DEFAULT_LANGUAGE.romanization} "${word.arabizi}" or its script`
        : `the English meaning "${word.english}"${context ? ", or any translation of the context sentence" : ""}`,
    },
    widget,
  };
}

export async function buildReviewWidget(
  ctx: ToolContext,
  word: { id: string; language_id: string; arabizi: string; script: string | null; english: string; memory_hook: string | null },
  level: WordLevel,
  contextSentence?: ContextSentenceInput,
  slipping = false
): Promise<Widget> {
  // The stored english can embed a usage example that contains the word
  // itself ("mind / attention (as in 'khalli belak')") -- shown on a card it
  // gives the answer away in both directions, so every displayed english
  // goes through the leak guard. The guarded text still grades as an exact
  // match (englishVariants covers the parens-free form).
  const english = leakFreeEnglish(word.english, word.arabizi);
  // Same guard for the memory hook: hooks are written ABOUT the word and
  // routinely quote it ("'nrou7' after yalla..."), which on a production
  // card is the answer in plain sight. A leaky hook is simply dropped.
  const memoryHook = word.memory_hook && !leaksWord(word.memory_hook, word.arabizi) ? word.memory_hook : null;
  // Ground truth rides along (not rendered on the card) so the client can
  // grade exact matches instantly instead of waiting on a round trip.
  const answer = { arabizi: word.arabizi, english };
  // The word's numbered level decides the FORMAT (see levels.ts for the
  // ladder); the color says how the word is doing (see flavorForWord) --
  // only the prompt phrasing stays random.
  const flavor = flavorForWord(level, slipping);
  const tier = tierForLevel(level);
  const rom = DEFAULT_LANGUAGE.romanization;
  const sentence = usableSentence(contextSentence, word.arabizi);
  // A whole sentence stored as a "word" makes a ludicrous quoted prompt --
  // long cues get referred to as "this", never re-quoted.
  const shortWord = word.arabizi.length <= 24;
  const shortEnglish = english.length <= 30;

  // Levels 4-5: cold production -- type the word from memory. A supplied
  // sentence turns it into fill-in-the-blank (most natural at level 5,
  // where the word is established and context is the remaining challenge).
  if (level >= 4) {
    const cue: ReviewCue = { english, memory_hook: memoryHook };
    // Cloze: the word is blanked out HERE, so the rendered widget never
    // carries the sentence with the answer still in it.
    const context: ReviewContext | undefined = sentence
      ? { target: sentence.target.replace(wordPattern(word.arabizi), "____"), english: sentence.english }
      : undefined;
    return {
      type: "produce_cold",
      word_id: word.id,
      tier,
      level,
      prompt: context
        ? pick([
            `Fill the blank — type the missing ${rom}.`,
            `Complete the sentence — what's the missing word?`,
          ])
        : shortEnglish
        ? pick([
            `Type the ${rom} for "${english}" — no options, from memory.`,
            `How do you say "${english}"? Type the ${rom}.`,
            `You need "${english}" mid-conversation — type it in ${rom}.`,
          ])
        : `How do you say this? Type the ${rom} from memory.`,
      cue,
      answer,
      flavor,
      context,
      // The meaning is already the visible cue on this tier, so an image of
      // the concept can't leak anything.
      image_url: await findImageForWord(ctx.supabase, word.english),
    };
  }

  const cue: ReviewCue = { arabizi: word.arabizi, script: word.script };
  // Recognition context: the sentence is shown in the language only -- its
  // translation is deliberately dropped here, never just hidden client-side.
  const context: ReviewContext | undefined = sentence ? { target: sentence.target } : undefined;
  const recognitionPrompt = context
    ? shortWord
      ? `What does "${word.arabizi}" mean here?`
      : "What does this mean here?"
    : shortWord
    ? pick([
        `What does "${word.arabizi}" mean?`,
        `You overhear "${word.arabizi}" — what did they say?`,
        `Quick one: "${word.arabizi}" in English?`,
      ])
    : "What does this mean?";

  // Level 3: typed meaning, no options.
  if (level === 3) {
    return {
      type: "recall_input",
      word_id: word.id,
      tier,
      level,
      prompt: recognitionPrompt,
      cue,
      answer,
      flavor,
      context,
    };
  }

  // Level 2: scaffolded production -- assemble the word from its own
  // scrambled tiles, the stepping stone toward level 4's cold typing.
  // Never when a context sentence is attached (the sentence contains the
  // word, so the card would print its own answer), and only when the word
  // splits into a real puzzle; otherwise fall through to the level-1 form.
  const tileSet = level === 2 && !context ? buildTiles(word.arabizi) : null;
  if (tileSet) {
    return {
      type: "word_builder",
      word_id: word.id,
      tier,
      level,
      prompt:
        tileSet.separator === " "
          ? shortEnglish
            ? pick([
                `Put the words in order for "${english}".`,
                `Arrange the tiles — how do you say "${english}"?`,
              ])
            : "Put the words in order — how do you say this?"
          : shortEnglish
          ? pick([
              `Build the word for "${english}" from the tiles.`,
              `Tap the letters in order — how do you say "${english}"?`,
            ])
          : "Build it from the tiles — how do you say this?",
      cue: { english, memory_hook: memoryHook },
      tiles: tileSet.tiles,
      separator: tileSet.separator,
      size: tileSet.size,
      answer,
      flavor,
      // English is already the visible cue, so a concept image can't leak.
      image_url: await findImageForWord(ctx.supabase, word.english),
    };
  }

  // Levels 1-2 (when tiles don't apply): reversed choice -- English shown,
  // word options. Never when a context sentence is attached: the sentence
  // contains the word, so a reversed card would print its own answer.
  if (level >= 1 && !context) {
    const distractors = await getDistractors(ctx, word, "arabizi");
    return {
      type: "quiz_mc",
      word_id: word.id,
      tier,
      level,
      direction: "to_target",
      prompt: shortEnglish
        ? pick([`Which one means "${english}"?`, `Pick the word for "${english}".`])
        : "Which one means this?",
      cue: { english },
      options: shuffle([word.arabizi, ...distractors]),
      answer,
      flavor,
    };
  }

  // Level 0 (and any context-carrying card below level 3): recognition
  // multiple choice. Distractors get the same leak guard against THIS
  // word -- an option that happens to mention the cue word would pull
  // clicks the same way the answer's own example did.
  const distractors = await getDistractors(ctx, word, "english");
  return {
    type: "quiz_mc",
    word_id: word.id,
    tier,
    level,
    direction: "to_english",
    prompt: recognitionPrompt,
    cue,
    options: shuffle([english, ...distractors.map((option) => leakFreeEnglish(option, word.arabizi))]),
    answer,
    flavor,
    context,
  };
}

async function getDistractors(
  ctx: ToolContext,
  word: { id: string; language_id: string; english: string; arabizi: string },
  field: "english" | "arabizi"
) {
  const { data } = await ctx.supabase
    .from("v2_words")
    .select(field)
    .eq("language_id", word.language_id)
    .neq("id", word.id)
    .limit(20);

  const own = word[field].toLowerCase();
  const pool = Array.from(
    new Set((data ?? []).map((w) => (w as Record<string, string>)[field]))
  ).filter((value) => value && value.toLowerCase() !== own);
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
): Promise<{ result: unknown; widget?: Widget }> {
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

function relativeTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `~${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `~${hours}h`;
  return `~${Math.round(hours / 24)}d`;
}

// Overturns the latest grade: recomputes the schedule from the word's
// current SRS state with the corrected outcome. The math stays in
// calculateNextReview -- the model only decides THAT a correction is fair,
// never what the schedule becomes. review_count is not re-incremented
// (it's a correction, not a new review).
async function regradeReview(
  ctx: ToolContext,
  wordId: string,
  correct: boolean
): Promise<{ result: unknown; widget?: Widget }> {
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

  const tier = tierForLevel(levelForProgress(progress));
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
    widget: {
      type: "data_change",
      action: "regraded",
      arabizi: word?.arabizi ?? "",
      changes: [
        { field: "marked", to: correct ? "correct" : "incorrect" },
        {
          field: "next review",
          from: progress.next_review_date ? relativeTime(progress.next_review_date) : null,
          to: relativeTime(nextReviewDate.toISOString()),
        },
      ],
    },
  };
}

async function rescheduleWord(
  ctx: ToolContext,
  wordId: string,
  hoursFromNow: number
): Promise<{ result: unknown; widget?: Widget }> {
  const hours = Number.isFinite(hoursFromNow) ? Math.max(0, hoursFromNow) : 0;
  const nextReview = new Date(Date.now() + hours * 3600_000).toISOString();

  const { data: before } = await ctx.supabase
    .from("v2_word_progress")
    .select("next_review_date, v2_words!inner(arabizi)")
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId)
    .maybeSingle();
  if (!before) return { result: { error: "No progress found for that word." } };

  const { error } = await ctx.supabase
    .from("v2_word_progress")
    .update({ next_review_date: nextReview, updated_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .eq("word_id", wordId);
  if (error) throw error;

  const arabizi = (before.v2_words as unknown as { arabizi: string }).arabizi;
  return {
    result: { word_id: wordId, next_review_date: nextReview },
    widget: {
      type: "data_change",
      action: "rescheduled",
      arabizi,
      changes: [
        {
          field: "next review",
          from: before.next_review_date ? relativeTime(before.next_review_date) : null,
          to: relativeTime(nextReview),
        },
      ],
    },
  };
}

const EDITABLE_WORD_FIELDS = ["arabizi", "script", "english", "type", "memory_hook"] as const;

async function updateWord(
  ctx: ToolContext,
  wordId: string,
  input: Record<string, unknown>
): Promise<{ result: unknown; widget?: Widget }> {
  const { data: word, error: readError } = await ctx.supabase
    .from("v2_words")
    .select("user_id, pack_id, arabizi, script, english, type, memory_hook")
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

  const changes = Object.entries(patch).map(([field, to]) => ({
    field,
    from: (word as Record<string, string | null>)[field] ?? null,
    to,
  }));
  return {
    result: { word_id: wordId, updated: patch },
    widget: { type: "data_change", action: "edited", arabizi: patch.arabizi ?? word.arabizi, changes },
  };
}

// The whole collection, compact: made for whole-vocabulary jobs (dedupe,
// audits). A few hundred rows fits comfortably in the model's context.
async function listAllWords(ctx: ToolContext) {
  const { data, error } = await ctx.supabase
    .from("v2_word_progress")
    .select("word_id, status, review_count, next_review_date, v2_words!inner(arabizi, script, english, type, user_id, pack_id)")
    .eq("user_id", ctx.userId)
    .order("next_review_date", { ascending: true });
  if (error) throw error;

  type W = { arabizi: string; script: string | null; english: string; type: string | null; user_id: string | null; pack_id: string | null };
  const words = (data ?? []).map((row) => {
    const w = row.v2_words as unknown as W;
    return {
      word_id: row.word_id,
      arabizi: w.arabizi,
      script: w.script,
      english: w.english,
      type: w.type,
      owned: w.user_id === ctx.userId && w.pack_id === null,
      status: row.status,
      review_count: row.review_count,
      next_review_date: row.next_review_date,
    };
  });
  return { result: { count: words.length, words } };
}

async function deleteWords(ctx: ToolContext, wordIds: string[]): Promise<{ result: unknown; widget?: Widget }> {
  if (wordIds.length === 0) return { result: { error: "word_ids is empty." } };

  const { data: words, error: readError } = await ctx.supabase
    .from("v2_words")
    .select("id, arabizi, user_id, pack_id")
    .in("id", wordIds);
  if (readError) throw readError;
  if (!words || words.length === 0) return { result: { error: "No matching words found." } };

  const { error: progressError } = await ctx.supabase
    .from("v2_word_progress")
    .delete()
    .eq("user_id", ctx.userId)
    .in("word_id", wordIds);
  if (progressError) throw progressError;

  // Their own custom words disappear entirely; pack words just leave the
  // queue and stay in the reservoir. RLS backstops the ownership check.
  const ownedIds = words.filter((w) => w.user_id === ctx.userId && w.pack_id === null).map((w) => w.id);
  if (ownedIds.length > 0) {
    const { error: deleteError } = await ctx.supabase.from("v2_words").delete().in("id", ownedIds);
    if (deleteError) throw deleteError;
  }

  const shown = words.slice(0, 8);
  return {
    result: {
      removed: words.map((w) => ({ word_id: w.id, arabizi: w.arabizi })),
      deleted_entirely: ownedIds.length,
    },
    widget: {
      type: "data_change",
      action: "deleted",
      arabizi: words.length === 1 ? words[0].arabizi : `${words.length} words`,
      changes: [
        ...shown.map((w) => ({
          field: w.arabizi,
          from: "in your queue",
          to: ownedIds.includes(w.id) ? "deleted entirely" : "removed (still in the pack)",
        })),
        ...(words.length > shown.length
          ? [{ field: `+${words.length - shown.length} more`, to: "removed" }]
          : []),
      ],
    },
  };
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function updateInstructions(
  ctx: ToolContext,
  instructions: string
): Promise<{ result: unknown; widget?: Widget }> {
  const trimmed = instructions.trim();
  if (!trimmed) return { result: { error: "Instructions can't be empty." } };

  const { data: existing } = await ctx.supabase
    .from("v2_user_settings")
    .select("tutor_instructions")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const { error } = await ctx.supabase
    .from("v2_user_settings")
    .upsert(
      { user_id: ctx.userId, tutor_instructions: trimmed, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) throw error;

  return {
    result: { saved: true, instructions: trimmed },
    widget: {
      type: "data_change",
      action: "edited",
      arabizi: "coaching instructions",
      changes: [
        {
          field: "instructions",
          from: existing?.tutor_instructions ? truncate(existing.tutor_instructions) : null,
          to: truncate(trimmed),
        },
      ],
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

function suggestChips(input: unknown): { result: unknown; widget?: Widget } {
  const chips = (Array.isArray(input) ? input : [])
    .map((chip) => ({
      label: String((chip as { label?: unknown })?.label ?? "").trim(),
      send: String((chip as { send?: unknown })?.send ?? "").trim(),
    }))
    .filter((chip) => chip.label && chip.send)
    .slice(0, 3);
  if (chips.length === 0) {
    return { result: { error: "No usable chips given -- each needs a label and a send message." } };
  }
  return {
    result: { offered: chips.map((chip) => chip.label) },
    widget: { type: "suggested_chips", chips },
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
