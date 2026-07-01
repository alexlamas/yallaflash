import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { validateRequest } from "@/app/api/utils";
import { calculateNextReview } from "@/app/services/spacedRepetitionService";
import { gradeColdRecall, gradeRecognition } from "@/app/v2/lib/grading";
import type { ReviewTier } from "@/app/v2/lib/types";

// Near-miss grading can make a Claude call on top of DB round trips.
export const maxDuration = 30;

type AnswerRequest = {
  wordId: string;
  tier: ReviewTier;
  submitted: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<AnswerRequest>(data, ["wordId", "tier", "submitted"])) {
      return NextResponse.json({ error: "wordId, tier, and submitted are required" }, { status: 400 });
    }
    const { wordId, tier, submitted } = data;

    const { data: word, error: wordError } = await supabase
      .from("v2_words")
      .select("arabizi, english, script, etymology_note, etymology_confidence")
      .eq("id", wordId)
      .single();
    if (wordError) throw wordError;

    const correct =
      tier === "hard" ? await gradeColdRecall(submitted, word.arabizi) : gradeRecognition(submitted, word.english);

    const rating = !correct ? 0 : tier === "hard" ? 3 : 2;

    const { data: progress } = await supabase
      .from("v2_word_progress")
      .select("interval, ease_factor, review_count")
      .eq("user_id", user.id)
      .eq("word_id", wordId)
      .maybeSingle();

    const { interval, easeFactor, nextReviewDate } = calculateNextReview(
      progress?.interval ?? 0,
      progress?.ease_factor ?? 2.5,
      rating,
      progress?.review_count ?? 0
    );

    const { error: upsertError } = await supabase.from("v2_word_progress").upsert(
      {
        user_id: user.id,
        word_id: wordId,
        status: rating >= 2 ? "learned" : "learning",
        interval,
        ease_factor: easeFactor,
        review_count: (progress?.review_count ?? 0) + 1,
        next_review_date: nextReviewDate.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,word_id" }
    );
    if (upsertError) throw upsertError;

    return NextResponse.json({
      correct,
      arabizi: word.arabizi,
      script: word.script,
      etymology_note: word.etymology_note,
      etymology_confidence: word.etymology_confidence,
      next_review_date: nextReviewDate.toISOString(),
    });
  } catch (error) {
    console.error("[v2/review/answer]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Grading failed: ${message}` }, { status: 500 });
  }
}
