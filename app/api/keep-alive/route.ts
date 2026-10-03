import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Hit daily by a Vercel cron (see vercel.json) so the Supabase free-tier
// project never goes 7 days without activity and gets paused.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await supabase.from("packs").select("id").limit(1);

  if (error) {
    console.error("Keep-alive query failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
