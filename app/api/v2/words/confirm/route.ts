import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { handleApiError, validateRequest } from "@/app/api/utils";
import { getDefaultLanguageId } from "@/app/v2/lib/tools";
import type { WordProposal } from "@/app/v2/lib/types";

type ConfirmRequest = {
  proposals: WordProposal[];
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<ConfirmRequest>(data, ["proposals"]) || data.proposals.length === 0) {
      return NextResponse.json({ error: "proposals is required" }, { status: 400 });
    }

    const languageId = await getDefaultLanguageId(supabase);

    const { data: inserted, error: insertError } = await supabase
      .from("v2_words")
      .insert(
        data.proposals.map((p) => ({
          language_id: languageId,
          arabizi: p.arabizi,
          english: p.english,
          type: p.type ?? null,
          notes: p.notes ?? null,
          memory_hook: p.memory_hook ?? null,
          user_id: user.id,
          pack_id: null,
        }))
      )
      .select("*");
    if (insertError) throw insertError;

    const now = new Date().toISOString();
    const { error: progressError } = await supabase.from("v2_word_progress").insert(
      (inserted ?? []).map((word) => ({
        word_id: word.id,
        user_id: user.id,
        status: "new",
        next_review_date: now,
      }))
    );
    if (progressError) throw progressError;

    return NextResponse.json({ words: inserted });
  } catch (error) {
    return handleApiError(error, "Failed to save words");
  }
}
