import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage } from "@/app/api/utils";

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("v2_word_progress")
      .select(
        "status, interval, ease_factor, review_count, next_review_date, updated_at, v2_words!inner(id, arabizi, english)"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const now = Date.now();
    const counts = { new: 0, learning: 0, learned: 0, dueNow: 0 };
    const words = (data ?? []).map((row) => {
      const word = row.v2_words as unknown as { id: string; arabizi: string; english: string };
      if (row.status === "new") counts.new += 1;
      else if (row.status === "learning") counts.learning += 1;
      else if (row.status === "learned") counts.learned += 1;
      if (new Date(row.next_review_date).getTime() <= now) counts.dueNow += 1;
      return {
        id: word.id,
        arabizi: word.arabizi,
        english: word.english,
        status: row.status,
        interval: row.interval,
        ease_factor: row.ease_factor,
        review_count: row.review_count,
        next_review_date: row.next_review_date,
        updated_at: row.updated_at,
      };
    });

    return NextResponse.json({ counts, words });
  } catch (error) {
    console.error("[v2/progress]", error);
    return NextResponse.json({ error: `Progress failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
