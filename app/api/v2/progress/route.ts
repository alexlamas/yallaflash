import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("v2_word_progress")
      .select("status, next_review_date, updated_at, v2_words!inner(id, arabizi, english)")
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
        next_review_date: row.next_review_date,
      };
    });

    return NextResponse.json({ counts, words });
  } catch (error) {
    console.error("[v2/progress]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Progress failed: ${message}` }, { status: 500 });
  }
}
