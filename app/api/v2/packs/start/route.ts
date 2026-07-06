import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { handleApiError, validateRequest } from "@/app/api/utils";

type StartPackRequest = {
  packId: string;
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<StartPackRequest>(data, ["packId"])) {
      return NextResponse.json({ error: "packId is required" }, { status: 400 });
    }

    const { data: words, error: wordsError } = await supabase
      .from("v2_words")
      .select("id")
      .eq("pack_id", data.packId);
    if (wordsError) throw wordsError;

    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from("v2_word_progress").upsert(
      (words ?? []).map((w) => ({
        word_id: w.id,
        user_id: user.id,
        status: "new",
        next_review_date: now,
      })),
      { onConflict: "user_id,word_id", ignoreDuplicates: true }
    );
    if (upsertError) throw upsertError;

    return NextResponse.json({ count: words?.length ?? 0 });
  } catch (error) {
    return handleApiError(error, "Failed to start pack");
  }
}
