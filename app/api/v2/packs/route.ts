import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { handleApiError } from "@/app/api/utils";

export async function GET() {
  try {
    const supabase = await createClient(cookies());
    const { data, error } = await supabase.from("v2_packs").select("id, language_id, name, description");
    if (error) throw error;
    return NextResponse.json({ packs: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Failed to load packs");
  }
}
