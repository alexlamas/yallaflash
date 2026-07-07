import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { errorMessage } from "@/app/api/utils";
import { DEFAULT_TUTOR_INSTRUCTIONS } from "@/app/v2/lib/tutorPrompt";

// Read/write the user-editable tutor instructions. POST with
// { instructions } saves; POST {} just reads. Always returns the current
// effective instructions (defaults until the user customizes).

type SettingsRequest = {
  instructions?: string;
};

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getApiAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const data: SettingsRequest = await req.json().catch(() => ({}));

    if (typeof data.instructions === "string" && data.instructions.trim()) {
      const { error } = await supabase
        .from("v2_user_settings")
        .upsert(
          {
            user_id: user.id,
            tutor_instructions: data.instructions.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      return NextResponse.json({ instructions: data.instructions.trim(), isDefault: false });
    }

    const { data: settings, error: readError } = await supabase
      .from("v2_user_settings")
      .select("tutor_instructions")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;

    const instructions = settings?.tutor_instructions?.trim();
    return NextResponse.json({
      instructions: instructions || DEFAULT_TUTOR_INSTRUCTIONS,
      isDefault: !instructions,
    });
  } catch (error) {
    console.error("[v2/settings]", error);
    return NextResponse.json({ error: `Settings failed: ${errorMessage(error)}` }, { status: 500 });
  }
}
