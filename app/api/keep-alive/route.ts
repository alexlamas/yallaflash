import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Hit by Vercel crons (see vercel.json) so the Supabase free-tier project
// never looks inactive and gets paused. Supabase wants "a few user requests
// to the database each day", so each run reads several public tables.
export const dynamic = "force-dynamic";

const TABLES = ["packs", "words", "sentences", "songs"];

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

  const results = await Promise.all(
    TABLES.map((table) => supabase.from(table).select("id").limit(1))
  );
  const errors = results
    .map(({ error }, i) => (error ? `${TABLES[i]}: ${error.message}` : null))
    .filter(Boolean);

  if (errors.length === TABLES.length) {
    console.error("Keep-alive queries failed:", errors);
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }
  if (errors.length) console.warn("Some keep-alive queries failed:", errors);

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
