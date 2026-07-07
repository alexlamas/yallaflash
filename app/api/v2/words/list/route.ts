import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage } from "@/app/api/utils";

// Everything the user is learning, joined with SRS state -- the data behind
// the /words management table.

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("v2_word_progress")
      .select("word_id, status, interval, ease_factor, review_count, next_review_date, notes, v2_words!inner(*)")
      .eq("user_id", user.id)
      .order("next_review_date", { ascending: true });
    if (error) throw error;

    type WordRow = {
      id: string;
      arabizi: string;
      script: string | null;
      english: string;
      type: string | null;
      memory_hook: string | null;
      notes: string | null;
      user_id: string | null;
      pack_id: string | null;
    };

    const rows = (data ?? []).map((row) => {
      const word = row.v2_words as unknown as WordRow;
      return {
        word_id: word.id,
        arabizi: word.arabizi,
        script: word.script,
        english: word.english,
        type: word.type,
        memory_hook: word.memory_hook,
        word_notes: word.notes,
        user_note: (row as { notes?: string | null }).notes ?? null,
        owned: word.user_id === user.id && word.pack_id === null,
        status: row.status,
        interval: row.interval,
        review_count: row.review_count,
        next_review_date: row.next_review_date,
      };
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("[v2/words/list]", error);
    return NextResponse.json({ error: `Loading words failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
