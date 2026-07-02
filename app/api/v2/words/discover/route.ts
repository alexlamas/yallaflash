import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { errorMessage } from "@/app/api/utils";
import { getDefaultLanguageId } from "@/app/v2/lib/tools";

// The reservoir: pack words the user hasn't started yet. Used by the
// zero-due "learn something new" moment to offer a word-picker widget.

const CANDIDATE_COUNT = 6;

export async function POST() {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const languageId = await getDefaultLanguageId(supabase);

    // Personal scale: fetch the user's started word ids and filter in SQL
    // via not-in. Fine for hundreds of words.
    const { data: progress, error: progressError } = await supabase
      .from("v2_word_progress")
      .select("word_id")
      .eq("user_id", user.id);
    if (progressError) throw progressError;
    const startedIds = (progress ?? []).map((p) => p.word_id);

    let query = supabase
      .from("v2_words")
      .select("id, arabizi, script, english, type")
      .eq("language_id", languageId)
      .not("pack_id", "is", null)
      .limit(CANDIDATE_COUNT);
    if (startedIds.length > 0) {
      query = query.not("id", "in", `(${startedIds.join(",")})`);
    }
    const { data: candidates, error: wordsError } = await query;
    if (wordsError) throw wordsError;

    return NextResponse.json({ candidates: candidates ?? [] });
  } catch (error) {
    console.error("[v2/words/discover]", error);
    return NextResponse.json({ error: `Finding new words failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
