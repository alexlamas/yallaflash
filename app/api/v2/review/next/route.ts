import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { errorMessage, validateRequest } from "@/app/api/utils";
import { buildReviewWidget, getDefaultLanguageId, tierForProgress } from "@/app/v2/lib/tools";

// Serves the next due card deterministically -- one DB round trip, no model
// call -- so the Next/Skip buttons respond instantly. A hidden "[SERVED]"
// user message records the ground truth in the conversation so the tutor
// knows what's on the table when it's next invoked (for hints or verdicts).

type NextCardRequest = {
  conversationId: string;
  excludeWordId?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<NextCardRequest>(data, ["conversationId"])) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }
    const { conversationId, excludeWordId } = data;

    const { data: rows, error: dueError } = await supabase
      .from("v2_word_progress")
      .select("status, review_count, v2_words!inner(*)")
      .eq("user_id", user.id)
      .lte("next_review_date", new Date().toISOString())
      .order("next_review_date", { ascending: true })
      .limit(excludeWordId ? 2 : 1);
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
      const { data: message, error: msgError } = await supabase
        .from("v2_messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: "Nothing due right now. Add some words, or just ask me anything.",
          widgets: [],
        })
        .select("*")
        .single();
      if (msgError) throw msgError;
      return NextResponse.json({ message });
    }

    const word = row.v2_words as unknown as WordRow;
    const languageId = await getDefaultLanguageId(supabase);
    const ctx = { supabase, userId: user.id, languageId };
    const tier = tierForProgress({ status: row.status, review_count: row.review_count });
    const widget = await buildReviewWidget(ctx, word, tier);

    const served = `[SERVED] word_id=${word.id} arabizi="${word.arabizi}" english="${word.english}" tier=${tier} -- the app served this card directly; the user hasn't answered yet. The card asks for ${tier === "hard" ? "the arabizi from memory" : "the English meaning"}.`;
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
