import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { errorMessage } from "@/app/api/utils";
import { hasV2Access } from "@/app/v2/lib/access";

// Admin test tool: snapshot the user's V2 learning state and wipe it, so
// the account behaves like a brand-new user (onboarding and all). The
// snapshot is returned to the CLIENT for safekeeping (localStorage) and
// restored via /api/v2/dev/restore. Custom words are left in place -- with
// no progress rows they're invisible, and restore just reattaches progress.

export async function POST() {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !(await hasV2Access(supabase, user.id))) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { data: progress, error: progressError } = await supabase
      .from("v2_word_progress")
      .select("*")
      .eq("user_id", user.id);
    if (progressError) throw progressError;

    const { data: settings } = await supabase
      .from("v2_user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error: deleteProgressError } = await supabase
      .from("v2_word_progress")
      .delete()
      .eq("user_id", user.id);
    if (deleteProgressError) throw deleteProgressError;

    const { error: deleteSettingsError } = await supabase
      .from("v2_user_settings")
      .delete()
      .eq("user_id", user.id);
    if (deleteSettingsError) throw deleteSettingsError;

    return NextResponse.json({
      snapshot: { takenAt: new Date().toISOString(), progress: progress ?? [], settings: settings ?? null },
    });
  } catch (error) {
    console.error("[v2/dev/reset]", error);
    return NextResponse.json({ error: `Reset failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
