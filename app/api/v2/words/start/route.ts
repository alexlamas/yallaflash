import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { errorMessage, validateRequest } from "@/app/api/utils";

// Starts learning specific words (from the reservoir picker): inserts
// progress rows due immediately. Deterministic -- the app writes, not the model.

type StartWordsRequest = {
  wordIds: string[];
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<StartWordsRequest>(data, ["wordIds"]) || data.wordIds.length === 0) {
      return NextResponse.json({ error: "wordIds is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from("v2_word_progress").upsert(
      data.wordIds.map((wordId) => ({
        word_id: wordId,
        user_id: user.id,
        status: "new",
        next_review_date: now,
      })),
      { onConflict: "user_id,word_id", ignoreDuplicates: true }
    );
    if (upsertError) throw upsertError;

    return NextResponse.json({ count: data.wordIds.length });
  } catch (error) {
    console.error("[v2/words/start]", error);
    return NextResponse.json({ error: `Starting those words failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
