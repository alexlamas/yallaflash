import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage, validateRequest } from "@/app/api/utils";
import { buildReviewWidget, buildServedLine, getDefaultLanguageId, levelForProgress } from "@/app/v2/lib/tools";
import type { Widget } from "@/app/v2/lib/types";

// Serves the next due card deterministically -- one DB round trip, no model
// call. Three modes:
//   default        pick the next due word, persist [SERVED] + widget message
//   peek: true     build and return the widget WITHOUT touching the
//                  conversation -- the client prefetches the next card while
//                  the user is still answering the current one
//   commitWidget   persist a previously peeked widget; the client already
//                  rendered it instantly, the conversation record catches up
// When nothing is due, returns { done: true } and the client owns the
// session-cleared moment (summary card built from its own tally).

type NextCardRequest = {
  conversationId: string;
  excludeWordId?: string;
  peek?: boolean;
  commitWidget?: Extract<Widget, { type: "quiz_mc" | "recall_input" | "produce_cold" | "word_builder" }>;
  // Boost-style early review: when nothing is due, serve the word whose
  // review is soonest anyway. Extra reps never hurt; scheduling still
  // belongs to the SRS write on answer.
  ahead?: boolean;
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<NextCardRequest>(data, ["conversationId"])) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }
    const { conversationId, excludeWordId, peek, commitWidget, ahead } = data;

    if (commitWidget) {
      // Ground truth for the [SERVED] line comes from the DB, not the
      // client payload -- the widget itself is just re-persisted verbatim.
      const { data: word, error: wordError } = await supabase
        .from("v2_words")
        .select("id, arabizi, english")
        .eq("id", commitWidget.word_id)
        .single();
      if (wordError) throw wordError;

      const served = buildServedLine(word, commitWidget);
      const { error: servedError } = await supabase
        .from("v2_messages")
        .insert({ conversation_id: conversationId, role: "user", content: served, widgets: [] });
      if (servedError) throw servedError;

      const { data: message, error: msgError } = await supabase
        .from("v2_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: "", widgets: [commitWidget] })
        .select("*")
        .single();
      if (msgError) throw msgError;
      return NextResponse.json({ message });
    }

    let dueQuery = supabase
      .from("v2_word_progress")
      .select("status, review_count, interval, v2_words!inner(*)")
      .eq("user_id", user.id)
      .order("next_review_date", { ascending: true })
      .limit(excludeWordId ? 2 : 1);
    // Normal serves respect the schedule; "review ahead" takes the soonest
    // word regardless.
    if (!ahead) {
      dueQuery = dueQuery.lte("next_review_date", new Date().toISOString());
    }
    const { data: rows, error: dueError } = await dueQuery;
    if (dueError) throw dueError;

    type WordRow = {
      id: string;
      language_id: string;
      arabizi: string;
      script: string | null;
      english: string;
      memory_hook: string | null;
    };
    const row = (rows ?? []).find((r) => (r.v2_words as unknown as WordRow).id !== excludeWordId);

    if (!row) {
      // "Done" can mean two things: genuinely nothing due, or only the
      // just-skipped word remains (it's still due -- we merely excluded it).
      // The client copy must not claim a cleared queue in the second case.
      const excludedStillDue =
        !ahead &&
        (rows ?? []).some((r) => (r.v2_words as unknown as WordRow).id === excludeWordId);
      return NextResponse.json({ done: true, excludedStillDue });
    }

    const word = row.v2_words as unknown as WordRow;
    const languageId = await getDefaultLanguageId(supabase);
    const ctx = { supabase, userId: user.id, languageId };
    const level = levelForProgress({
      status: row.status,
      review_count: row.review_count,
      interval: row.interval,
    });
    const widget = await buildReviewWidget(ctx, word, level);

    if (peek) {
      return NextResponse.json({ widget });
    }

    const served = buildServedLine(
      word,
      widget as Extract<Widget, { type: "quiz_mc" | "recall_input" | "produce_cold" | "word_builder" }>
    );
    const { error: servedError } = await supabase
      .from("v2_messages")
      .insert({ conversation_id: conversationId, role: "user", content: served, widgets: [] });
    if (servedError) throw servedError;

    const { data: message, error: msgError } = await supabase
      .from("v2_messages")
      .insert({ conversation_id: conversationId, role: "assistant", content: "", widgets: [widget] })
      .select("*")
      .single();
    if (msgError) throw msgError;

    return NextResponse.json({ message });
  } catch (error) {
    console.error("[v2/review/next]", error);
    return NextResponse.json({ error: `Serving the next word failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
