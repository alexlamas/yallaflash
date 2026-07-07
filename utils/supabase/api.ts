import { createClient as createSupabaseClient, SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient } from "./server";

// API-route auth that works for both callers of the JSON API:
// - the website, where the Supabase session rides in cookies, and
// - the packaged native app (Capacitor), which calls cross-origin where
//   cookies don't flow and instead sends `Authorization: Bearer <token>`.
// The bearer client forwards the user's JWT on every query, so RLS applies
// exactly as it does for the cookie client.
export async function getApiAuth(
  req: Request
): Promise<{ supabase: SupabaseClient; user: User | null }> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (token) {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return { supabase, user };
  }

  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
