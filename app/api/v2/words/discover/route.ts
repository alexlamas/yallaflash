import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage } from "@/app/api/utils";
import { getDefaultLanguageId } from "@/app/v2/lib/tools";

// The reservoir: pack words the user hasn't started yet. Used by the
// zero-due "learn something new" moment to offer a word-picker widget.

const CANDIDATE_COUNT = 6;

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const languageId = await getDefaultLanguageId(supabase);

    // Personal scale: fetch what the user is already learning and exclude
    // both by id AND by content -- the V1 migration created personal copies
    // of words that also exist in the reservoir, and offering the pack twin
    // of a word you're already learning reads as a duplicate.
    const { data: progress, error: progressError } = await supabase
      .from("v2_word_progress")
      .select("word_id, v2_words!inner(arabizi, english)")
      .eq("user_id", user.id);
    if (progressError) throw progressError;

    const startedIds = (progress ?? []).map((p) => p.word_id);
    const norm = (s: string) => s.toLowerCase().trim();
    const knownContent = new Set(
      (progress ?? []).map((p) => {
        const w = p.v2_words as unknown as { arabizi: string; english: string };
        return `${norm(w.arabizi)}|${norm(w.english)}`;
      })
    );

    let query = supabase
      .from("v2_words")
      .select("id, arabizi, script, english, type")
      .eq("language_id", languageId)
      .not("pack_id", "is", null)
      .limit(CANDIDATE_COUNT * 4);
    if (startedIds.length > 0) {
      query = query.not("id", "in", `(${startedIds.join(",")})`);
    }
    const { data: rows, error: wordsError } = await query;
    if (wordsError) throw wordsError;

    const candidates = (rows ?? [])
      .filter((w) => !knownContent.has(`${norm(w.arabizi)}|${norm(w.english)}`))
      .slice(0, CANDIDATE_COUNT);

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("[v2/words/discover]", error);
    return NextResponse.json({ error: `Finding new words failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
