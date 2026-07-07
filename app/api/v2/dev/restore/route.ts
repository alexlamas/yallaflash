import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage } from "@/app/api/utils";
import { hasV2Access } from "@/app/v2/lib/access";

// Admin test tool: restore a snapshot taken by /api/v2/dev/reset.

type RestoreRequest = {
  snapshot: {
    progress: Record<string, unknown>[];
    settings: Record<string, unknown> | null;
  };
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user || !(await hasV2Access(supabase, user.id))) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const data: RestoreRequest = await req.json();
    const progress = data.snapshot?.progress ?? [];

    if (progress.length > 0) {
      // Rows carry the original user_id; force ours and let RLS backstop.
      const rows = progress.map((row) => ({ ...row, user_id: user.id }));
      const { error } = await supabase
        .from("v2_word_progress")
        .upsert(rows, { onConflict: "user_id,word_id" });
      if (error) throw error;
    }

    if (data.snapshot?.settings) {
      const { error } = await supabase
        .from("v2_user_settings")
        .upsert({ ...data.snapshot.settings, user_id: user.id }, { onConflict: "user_id" });
      if (error) throw error;
    }

    return NextResponse.json({ restored: progress.length });
  } catch (error) {
    console.error("[v2/dev/restore]", error);
    return NextResponse.json({ error: `Restore failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
