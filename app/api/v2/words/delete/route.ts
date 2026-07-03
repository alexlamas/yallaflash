import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { errorMessage, validateRequest } from "@/app/api/utils";

// Bulk removal from the /words table: always removes the user's progress
// (stop learning); custom words the user owns are deleted entirely, pack
// words stay in the shared reservoir.

type DeleteRequest = {
  wordIds: string[];
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data = await req.json();
    if (!validateRequest<DeleteRequest>(data, ["wordIds"]) || data.wordIds.length === 0) {
      return NextResponse.json({ error: "wordIds is required" }, { status: 400 });
    }

    const { error: progressError } = await supabase
      .from("v2_word_progress")
      .delete()
      .eq("user_id", user.id)
      .in("word_id", data.wordIds);
    if (progressError) throw progressError;

    // RLS restricts this delete to their own custom words automatically.
    const { error: wordsError } = await supabase
      .from("v2_words")
      .delete()
      .eq("user_id", user.id)
      .is("pack_id", null)
      .in("id", data.wordIds);
    if (wordsError) throw wordsError;

    return NextResponse.json({ removed: data.wordIds.length });
  } catch (error) {
    console.error("[v2/words/delete]", error);
    return NextResponse.json({ error: `Removing words failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
