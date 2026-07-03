import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { incrementUsage } from "@/app/services/aiUsageService";
import { errorMessage } from "@/app/api/utils";
import { TUTOR_SYSTEM_PROMPT } from "@/app/v2/lib/tutorPrompt";
import { TOOL_DEFINITIONS, executeTool, getDefaultLanguageId } from "@/app/v2/lib/tools";
import type { Widget } from "@/app/v2/lib/types";

// The tool loop makes up to MAX_TOOL_ITERATIONS sequential Claude calls;
// Vercel's default 10s function limit is not enough for that.
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-opus-4-8";
const MAX_TOOL_ITERATIONS = 5;

const ONBOARDING_GREETING =
  "Hey! I'm your Lebanese Arabic tutor. Want to add some words you already have in mind, or browse a starter pack to get going?";

type ChatRequest = {
  conversationId?: string;
  message?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
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

    // The Anthropic API requires the message list to start with a "user"
    // turn and strictly alternate roles. The deterministic bootstrap
    // greeting is stored as the first "assistant" row, so drop everything
    // before the first real user message. A prior turn that failed after
    // its user message was persisted (e.g. this exact bug) can also leave
    // two consecutive "user" rows -- merge consecutive same-role rows
    // rather than assume the history is already well-formed.
    const rows = historyRows ?? [];
    const firstUserIndex = rows.findIndex((row) => row.role === "user");
    const relevantRows = firstUserIndex === -1 ? [] : rows.slice(firstUserIndex);

    const messages: Anthropic.MessageParam[] = [];
    for (const row of relevantRows) {
      const last = messages[messages.length - 1];
      if (last && last.role === row.role && typeof last.content === "string") {
        last.content = `${last.content}\n${row.content}`;
      } else {
        messages.push({ role: row.role as "user" | "assistant", content: row.content });
      }
    }

    const widgets: Widget[] = [];
    let finalText = "";
    let lastStopReason: string | null = null;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        // Must fit a propose_words call for a long pasted list -- at 1024 the
        // tool_use block gets truncated and silently dropped, so the reply
        // text lands without its widget.
        max_tokens: 4096,
        system: TUTOR_SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });

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

    // A truncated response can silently drop an incomplete tool_use block --
    // if that killed the widget, at least tell the user what to do about it.
    if (lastStopReason === "max_tokens" && widgets.length === 0) {
      finalText = `${finalText}\n\nThat ran longer than I can handle in one go -- try pasting fewer words at a time.`.trim();
    }

    await incrementUsage(user.id);

    // Hint-leak guard: while a served card is unanswered, a word_card for
    // that word (e.g. from get_word_detail during a hint) would reveal the
    // hidden side. Strip it deterministically -- prompts alone don't hold.
    const openCardWordId = findOpenCardWordId(rows);
    const safeWidgets = widgets.filter(
      (w) => !(w.type === "word_card" && openCardWordId && w.word.id === openCardWordId)
    );

    const assistantMessage = await insertMessage(supabase, conversationId, "assistant", finalText, safeWidgets);
    return NextResponse.json({ conversationId, message: assistantMessage });
  } catch (error) {
    // V2 is in active development for personal use: log the real error to
    // Vercel runtime logs AND return it to the client so the error banner
    // is actually diagnosable, instead of a generic "failed" message.
    console.error("[v2/chat]", error);
    return NextResponse.json({ error: `Chat failed: ${errorMessage(error)}` }, { status: 500 });
  }
}

// The word on the table: the most recent [SERVED] card with no later
// [REVIEW RESULT] for the same word.
function findOpenCardWordId(rows: { role: string; content: string }[]): string | null {
  const answered = new Set<string>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const content = rows[i].content;
    if (content.startsWith("[REVIEW RESULT]")) {
      const match = content.match(/word_id=(\S+)/);
      if (match) answered.add(match[1]);
    } else if (content.startsWith("[SERVED]")) {
      const match = content.match(/word_id=(\S+)/);
      if (match) return answered.has(match[1]) ? null : match[1];
    }
  }
  return null;
}

async function createConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  supabase: Awaited<ReturnType<typeof createClient>>,
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
