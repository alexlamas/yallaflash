import { NextResponse } from "next/server";
import { getApiAuth } from "@/utils/supabase/api";
import { handleApiError } from "@/app/api/utils";

export async function GET(req: Request) {
  try {
    const { supabase } = await getApiAuth(req);
    const { data, error } = await supabase.from("v2_packs").select("id, language_id, name, description");
    if (error) throw error;
    return NextResponse.json({ packs: data ?? [] });
  } catch (error) {
    return handleApiError(error, "Failed to load packs");
  }
}
