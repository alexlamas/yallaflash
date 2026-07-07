import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { handleApiError, validateRequest } from "@/app/api/utils";
import { getDefaultLanguageId } from "@/app/v2/lib/tools";
import type { WordProposal } from "@/app/v2/lib/types";

type ConfirmRequest = {
  proposals: WordProposal[];
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<ConfirmRequest>(data, ["proposals"]) || data.proposals.length === 0) {
      return NextResponse.json({ error: "proposals is required" }, { status: 400 });
    }

    const languageId = await getDefaultLanguageId(supabase);

    // Duplicate guard: skip words the user is already learning, matched by
    // content -- the V1 migration created personal copies of reservoir
    // words, so id checks alone don't catch twins.
    const { data: existing } = await supabase
      .from("v2_word_progress")
      .select("v2_words!inner(arabizi, english)")
      .eq("user_id", user.id);
    const norm = (s: string) => s.toLowerCase().trim();
    const known = new Set(
      (existing ?? []).map((row) => {
        const w = row.v2_words as unknown as { arabizi: string; english: string };
        return `${norm(w.arabizi)}|${norm(w.english)}`;
      })
    );
    const fresh = data.proposals.filter((p) => !known.has(`${norm(p.arabizi)}|${norm(p.english)}`));
    const skipped = data.proposals.length - fresh.length;
    if (fresh.length === 0) {
      return NextResponse.json({ words: [], skipped });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("v2_words")
      .insert(
        fresh.map((p) => ({
          language_id: languageId,
          arabizi: p.arabizi,
          english: p.english,
          script: p.script ?? null,
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

    return NextResponse.json({ words: inserted, skipped });
  } catch (error) {
    return handleApiError(error, "Failed to save words");
  }
}
