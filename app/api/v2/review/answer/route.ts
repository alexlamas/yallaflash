import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage, validateRequest } from "@/app/api/utils";
import { calculateNextReview } from "@/app/services/spacedRepetitionService";
import { gradeColdRecall, gradeDeterministic, gradeRecognition, type GradeVerdict } from "@/app/v2/lib/grading";
import { findImageForWord } from "@/app/v2/lib/tools";
import type { ReviewDirection, ReviewTier } from "@/app/v2/lib/types";

// Near-miss grading can make a Claude call on top of DB round trips.
export const maxDuration = 30;

type AnswerRequest = {
  wordId: string;
  tier: ReviewTier;
  // Reversed cards (English shown, word picked) grade against the word
  // itself. Absent means the classic to-English direction.
  direction?: ReviewDirection;
  submitted?: string;
  // "Show answer" pressed: grade as a miss without an attempt.
  concede?: boolean;
  // A hint was used before answering: correct still counts, but as
  // "struggled" -- shorter interval, slight ease penalty, stays learning.
  hinted?: boolean;
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<AnswerRequest>(data, ["wordId", "tier"])) {
      return NextResponse.json({ error: "wordId and tier are required" }, { status: 400 });
    }
    const { wordId, tier, concede, hinted } = data;
    const submitted = typeof data.submitted === "string" ? data.submitted : "";
    if (!concede && !submitted.trim()) {
      return NextResponse.json({ error: "submitted is required unless conceding" }, { status: 400 });
    }

    const { data: word, error: wordError } = await supabase
      .from("v2_words")
      .select("arabizi, english, script, etymology_note, etymology_confidence")
      .eq("id", wordId)
      .single();
    if (wordError) throw wordError;

    // Easy tier is multiple choice -- clicked options must match exactly,
    // so the synonym fallback stays off there. Reversed multiple choice
    // grades against the word itself, deterministically (options are the
    // stored strings, so a click is never a near-miss).
    const direction = data.direction === "to_target" ? "to_target" : "to_english";
    const verdict: GradeVerdict = concede
      ? { correct: false }
      : tier === "hard"
      ? await gradeColdRecall(submitted, word.arabizi)
      : direction === "to_target"
      ? { correct: gradeDeterministic(tier, submitted, { arabizi: word.arabizi, english: word.english }, direction) === true }
      : await gradeRecognition(submitted, word.english, { llmFallback: tier === "medium" });

    const correct = verdict.correct;
    // Only a model judgment can set this: an answer that isn't right but
    // isn't a plain miss either (right word with a real error, overlapping
    // meaning). It schedules as "struggled" -- rating 1, a short interval --
    // instead of the full reset a miss gets. Deterministic grades and
    // concessions stay strictly correct/wrong.
    const partial = !correct && verdict.partial === true;
    const rating = correct ? (hinted ? 1 : tier === "hard" ? 3 : 2) : partial ? 1 : 0;

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
        // The ladder must pass through typed recall: a lucky multiple-choice
        // click (easy tier) proves recognition, not knowledge -- "learned"
        // is only earned by a full success on medium or hard.
        status: rating >= 2 && tier !== "easy" ? "learned" : "learning",
        interval,
        ease_factor: easeFactor,
        review_count: (progress?.review_count ?? 0) + 1,
        next_review_date: nextReviewDate.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,word_id" }
    );
    if (upsertError) throw upsertError;

    // Post-answer is the leak-safe moment to surface the image bank.
    const imageUrl = await findImageForWord(supabase, word.english);

    return NextResponse.json({
      correct,
      partial,
      // The model's one-line reason when it judged a non-obvious answer,
      // shown on the verdict card so the grade never looks arbitrary.
      note: verdict.note ?? null,
      arabizi: word.arabizi,
      english: word.english,
      script: word.script,
      etymology_note: word.etymology_note,
      etymology_confidence: word.etymology_confidence,
      next_review_date: nextReviewDate.toISOString(),
      image_url: imageUrl,
    });
  } catch (error) {
    console.error("[v2/review/answer]", error);
    return NextResponse.json({ error: `Grading failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
