import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { errorMessage, validateRequest } from "@/app/api/utils";

// Inline edits from the /words table. Word fields only apply to user-owned
// custom words (pack words are shared); the per-user note applies to any word.

const EDITABLE_FIELDS = ["arabizi", "script", "english", "type", "memory_hook"] as const;

type UpdateRequest = {
  wordId: string;
  fields?: Partial<Record<(typeof EDITABLE_FIELDS)[number], string>>;
  userNote?: string | null;
  // Row-level reschedule (boost to now, push to tomorrow/next week).
  nextReviewHours?: number;
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data: UpdateRequest = await req.json();
    if (!validateRequest<UpdateRequest>(data, ["wordId"])) {
      return NextResponse.json({ error: "wordId is required" }, { status: 400 });
    }

    if (data.fields && Object.keys(data.fields).length > 0) {
      const { data: word, error: readError } = await supabase
        .from("v2_words")
        .select("user_id, pack_id")
        .eq("id", data.wordId)
        .maybeSingle();
      if (readError) throw readError;
      if (!word || word.user_id !== user.id || word.pack_id !== null) {
        return NextResponse.json(
          { error: "Only your own custom words can be edited -- pack words are shared." },
          { status: 403 }
        );
      }
      const patch: Record<string, string> = {};
      for (const field of EDITABLE_FIELDS) {
        const value = data.fields[field];
        if (typeof value === "string") patch[field] = value.trim();
      }
      if (!patch.arabizi && "arabizi" in patch) delete patch.arabizi;
      if (!patch.english && "english" in patch) delete patch.english;
      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await supabase.from("v2_words").update(patch).eq("id", data.wordId);
        if (updateError) throw updateError;
      }
    }

    if (typeof data.nextReviewHours === "number" && Number.isFinite(data.nextReviewHours)) {
      const next = new Date(Date.now() + Math.max(0, data.nextReviewHours) * 3600_000).toISOString();
      const { error: schedError } = await supabase
        .from("v2_word_progress")
        .update({ next_review_date: next, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("word_id", data.wordId);
      if (schedError) throw schedError;
    }

    if (data.userNote !== undefined) {
      const { error: noteError } = await supabase
        .from("v2_word_progress")
        .update({ notes: data.userNote })
        .eq("user_id", user.id)
        .eq("word_id", data.wordId);
      if (noteError) throw noteError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[v2/words/update]", error);
    return NextResponse.json({ error: `Updating the word failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
