import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getApiAuth } from "@/utils/supabase/api";
import { incrementUsage } from "@/app/services/aiUsageService";
import { errorMessage } from "@/app/api/utils";
import { DEFAULT_TUTOR_INSTRUCTIONS, TUTOR_SYSTEM_PROMPT } from "@/app/v2/lib/tutorPrompt";
import { DEFAULT_LANGUAGE } from "@/app/v2/lib/language";
import { TOOL_DEFINITIONS, executeTool, getDefaultLanguageId } from "@/app/v2/lib/tools";
import type { Widget } from "@/app/v2/lib/types";

// The tool loop makes up to MAX_TOOL_ITERATIONS sequential Claude calls;
// Vercel's default 10s function limit is not enough for that. 60 is the
// Hobby-plan ceiling -- values above it fail the build, they don't clamp.
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Sonnet: the deterministic layer owns correctness (grading, scheduling,
// cards), so the tutor's job -- framing, parsing, tool calls -- doesn't
// need Opus, and Sonnet responds noticeably faster.
const MODEL = "claude-sonnet-5";
const MAX_TOOL_ITERATIONS = 5;

const ONBOARDING_GREETING = `Hey! I'm your ${DEFAULT_LANGUAGE.name} tutor. Want to add some words you already have in mind, or browse a starter pack to get going?`;

type ChatRequest = {
  conversationId?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // The auth middleware can strip the POST body while refreshing a
    // just-issued session token (fresh signup -> first bootstrap call), and
    // the bootstrap body is empty-ish anyway -- treat unparseable as empty.
    const body: ChatRequest = await req.json().catch(() => ({}));
    const conversationId = body.conversationId ?? (await createConversation(supabase, user.id));

    // Bootstrap call for a brand-new conversation: skip the model entirely.
    // Returning users (any words in progress) get a session-ready greeting so
    // the Start review / Add words chips are immediately available; only
    // genuinely new users see the onboarding choice.
    if (!body.message) {
      const { count: wordCount } = await supabase
        .from("v2_word_progress")
        .select("word_id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((wordCount ?? 0) > 0) {
        const { count: dueCount } = await supabase
          .from("v2_word_progress")
          .select("word_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .lte("next_review_date", new Date().toISOString());

        const greeting =
          (dueCount ?? 0) > 0
            ? `Ahla w sahla! You have ${dueCount} word${dueCount === 1 ? "" : "s"} due -- yalla?`
            : "Ahla w sahla! Nothing due right now. Add new words, or review ahead anyway?";
        const assistantMessage = await insertMessage(supabase, conversationId, "assistant", greeting, []);
        return NextResponse.json({ conversationId, message: assistantMessage });
      }

      const assistantMessage = await insertMessage(supabase, conversationId, "assistant", ONBOARDING_GREETING, [
        { type: "onboarding_choice" },
        // How-I-coach is user-editable from the very first screen.
        { type: "instructions_editor", instructions: DEFAULT_TUTOR_INSTRUCTIONS },
      ]);
      return NextResponse.json({ conversationId, message: assistantMessage });
    }

    await insertMessage(supabase, conversationId, "user", body.message, []);

    const { data: historyRows, error: historyError } = await supabase
      .from("v2_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (historyError) throw historyError;

    const languageId = await getDefaultLanguageId(supabase);
    const ctx = { supabase, userId: user.id, languageId };

    // The user-editable slice of the tutor's behavior rides at the end of
    // the system prompt; the tutor can rewrite it via update_instructions.
    const { data: settings } = await supabase
      .from("v2_user_settings")
      .select("tutor_instructions")
      .eq("user_id", user.id)
      .maybeSingle();
    const instructions = settings?.tutor_instructions?.trim() || DEFAULT_TUTOR_INSTRUCTIONS;
    // Prompt caching: tools + the static prompt + the per-user instructions
    // are stable across turns, so cache breakpoints cut latency (and cost)
    // on every message after the first.
    // Cast: SDK 0.32.x predates the cache_control fields in its types; the
    // API itself accepts them.
    const system = [
      { type: "text", text: TUTOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: `USER'S STANDING INSTRUCTIONS (user-visible and editable -- follow them):\n${instructions}`,
        cache_control: { type: "ephemeral" },
      },
    ] as unknown as Anthropic.TextBlockParam[];
    const tools: Anthropic.Tool[] = TOOL_DEFINITIONS.map((tool, i) =>
      i === TOOL_DEFINITIONS.length - 1
        ? { ...tool, cache_control: { type: "ephemeral" as const } }
        : tool
    );

    // The Anthropic API requires the message list to start with a "user"
    // turn and strictly alternate roles. The deterministic bootstrap
    // greeting is stored as the first "assistant" row, so drop everything
    // before the first real user message. A prior turn that failed after
    // its user message was persisted (e.g. this exact bug) can also leave
    // two consecutive "user" rows -- merge consecutive same-role rows
    // rather than assume the history is already well-formed.
    // The conversation is permanent, but the model only reads a recent
    // window: word knowledge lives in the DB (tools), not in chat scrollback,
    // so unbounded history would only add cost and latency.
    const HISTORY_LIMIT = 40;
    const rows = historyRows ?? [];
    const firstUserIndex = rows.findIndex((row) => row.role === "user");
    let relevantRows = firstUserIndex === -1 ? [] : rows.slice(firstUserIndex);
    if (relevantRows.length > HISTORY_LIMIT) {
      const window = relevantRows.slice(-HISTORY_LIMIT);
      // The API requires the first message to be a user turn.
      const firstUser = window.findIndex((row) => row.role === "user");
      relevantRows = firstUser === -1 ? [] : window.slice(firstUser);
    }

    const messages: Anthropic.MessageParam[] = [];
    for (const row of relevantRows) {
      const last = messages[messages.length - 1];
      if (last && last.role === row.role && typeof last.content === "string") {
        last.content = `${last.content}\n${row.content}`;
      } else {
        messages.push({ role: row.role as "user" | "assistant", content: row.content });
      }
    }

    // Hint-leak guard state is needed BEFORE the loop when streaming: raw
    // deltas must be scrubbed as they're emitted, not just in the stored row.
    const openCard = findOpenCard(rows);

    // The tool loop, shared by both response modes. onText receives the
    // accumulated text of the CURRENT model call -- a later iteration's text
    // replaces an earlier one's (same overwrite semantics as before).
    const runLoop = async (onText?: (accumulated: string) => void) => {
      const widgets: Widget[] = [];
      let finalText = "";
      let lastStopReason: string | null = null;

      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const stream = anthropic.messages.stream({
          model: MODEL,
          // Must fit a propose_words call for a long pasted list -- at 1024 the
          // tool_use block gets truncated and silently dropped, so the reply
          // text lands without its widget.
          max_tokens: 4096,
          system,
          tools,
          messages,
        });

        if (onText) {
          let accumulated = "";
          stream.on("text", (delta) => {
            accumulated += delta;
            onText(accumulated);
          });
        }

        const response = await stream.finalMessage();

        lastStopReason = response.stop_reason;
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
        );
        finalText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        if (toolUseBlocks.length === 0) break;

        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          // A tool failure (bad input, transient DB error) goes back to the
          // model as an error result it can react to, instead of 500ing the
          // whole turn.
          try {
            const { result, widget } = await executeTool(ctx, block.name, block.input as Record<string, unknown>);
            if (widget) widgets.push(widget);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            console.error(`[v2/chat] tool ${block.name}`, error);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: errorMessage(error),
              is_error: true,
            });
          }
        }
        messages.push({ role: "user", content: toolResults });

        if (response.stop_reason !== "tool_use") break;
      }

      return { widgets, finalText, lastStopReason };
    };

    // Everything after the loop: max-tokens note, usage, leak guards,
    // persistence. Shared by both response modes.
    const finishTurn = async (loopResult: {
      widgets: Widget[];
      finalText: string;
      lastStopReason: string | null;
    }) => {
      let { finalText } = loopResult;
      const { widgets, lastStopReason } = loopResult;

      // A truncated response can silently drop an incomplete tool_use block --
      // if that killed the widget, at least tell the user what to do about it.
      if (lastStopReason === "max_tokens" && widgets.length === 0) {
        finalText = `${finalText}\n\nThat ran longer than I can handle in one go -- try pasting fewer words at a time.`.trim();
      }

      await incrementUsage(user.id, supabase);

      // Hint-leak guard: while a served card is unanswered, a word_card for
      // that word (e.g. from get_word_detail during a hint) would reveal the
      // hidden side. Strip it deterministically -- prompts alone don't hold.
      const safeWidgets = widgets.filter(
        (w) => !(w.type === "word_card" && openCard && w.word.id === openCard.wordId)
      );
      // Same guard for the reply text: the model's natural way to reference the
      // open card ("the 'l leyle' card is still waiting") names it by exactly
      // the side the card is quizzing. Swap the hidden side for the shown one.
      if (openCard) finalText = scrubOpenCardAnswer(finalText, openCard);

      return insertMessage(supabase, conversationId, "assistant", finalText, safeWidgets);
    };

    // Streaming mode (opt-in via Accept header): text deltas ride an SSE
    // stream as full-replace snapshots -- each event carries the whole text
    // so far, already scrubbed, so a delta can never leak the open card's
    // answer and iteration overwrites need no client bookkeeping.
    if (req.headers.get("accept") === "text/event-stream") {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (event: Record<string, unknown>) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          try {
            const loopResult = await runLoop((accumulated) => {
              send({ type: "text", partial: streamSafeText(accumulated, openCard) });
            });
            const assistantMessage = await finishTurn(loopResult);
            send({ type: "done", conversationId, message: assistantMessage });
          } catch (error) {
            console.error("[v2/chat]", error);
            send({ type: "error", error: `Chat failed: ${errorMessage(error)}` });
          }
          controller.close();
        },
      });
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const assistantMessage = await finishTurn(await runLoop());
    return NextResponse.json({ conversationId, message: assistantMessage });
  } catch (error) {
    // V2 is in active development for personal use: log the real error to
    // Vercel runtime logs AND return it to the client so the error banner
    // is actually diagnosable, instead of a generic "failed" message.
    console.error("[v2/chat]", error);
    return NextResponse.json({ error: `Chat failed: ${errorMessage(error)}` }, { status: 500 });
  }
}

// Streaming-safe view of in-flight text: scrub completed mentions of the open
// card's hidden side, and hold back any trailing PARTIAL match so the answer
// can't flash on screen for a frame before the scrub catches it. Because
// events are full-replace snapshots, held-back text is emitted (or scrubbed)
// by a later snapshot -- nothing is lost.
function streamSafeText(text: string, card: OpenCard | null): string {
  if (!card || !card.hidden.trim()) return text;
  const lower = text.toLowerCase();
  const hidden = card.hidden.toLowerCase();
  let cut = text.length;
  for (let k = Math.min(hidden.length - 1, lower.length); k > 0; k--) {
    if (lower.endsWith(hidden.slice(0, k))) {
      cut = text.length - k;
      break;
    }
  }
  return scrubOpenCardAnswer(text.slice(0, cut), card);
}

// The word on the table: the most recent [SERVED] card with no later
// [REVIEW RESULT] for the same word. Also parses which side the card shows
// and which it hides, so the reply text can be scrubbed of the answer.
type OpenCard = { wordId: string; shown: string; hidden: string };

function findOpenCard(rows: { role: string; content: string }[]): OpenCard | null {
  const answered = new Set<string>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const content = rows[i].content;
    if (content.startsWith("[REVIEW RESULT]")) {
      const match = content.match(/word_id=(\S+)/);
      if (match) answered.add(match[1]);
    } else if (content.startsWith("[SERVED]")) {
      const match = content.match(/word_id=(\S+) arabizi="([^"]*)" english="([^"]*)" tier=(\S+)/);
      if (!match) return null;
      const [, wordId, arabizi, english, tier] = match;
      if (answered.has(wordId)) return null;
      // The asks= token says which side the card hides (formats vary within
      // a tier now -- reversed multiple choice hides the word on the easy
      // tier). Older persisted lines lack it; fall back to the tier rule.
      const asksMatch = content.match(/asks=(arabizi|english)/);
      const hidesWord = asksMatch ? asksMatch[1] === "arabizi" : tier === "hard";
      return hidesWord
        ? { wordId, shown: english, hidden: arabizi }
        : { wordId, shown: arabizi, hidden: english };
    }
  }
  return null;
}

// Replace any mention of the open card's hidden side with its shown side, so
// "the 'l leyle' card is still waiting" becomes "the 'tonight' card is still
// waiting". Consumes wrapping quotes to avoid doubling them.
function scrubOpenCardAnswer(text: string, card: OpenCard): string {
  if (!card.hidden.trim()) return text;
  const escaped = card.hidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`["'‘’“”]?\\b${escaped}\\b["'‘’“”]?`, "gi");
  return text.replace(pattern, `"${card.shown}"`);
}

async function createConversation(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("v2_conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function insertMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  widgets: Widget[]
) {
  const { data, error } = await supabase
    .from("v2_messages")
    .insert({ conversation_id: conversationId, role, content, widgets })
    .select("id, conversation_id, role, content, widgets, created_at")
    .single();
  if (error) throw error;
  return data;
}
