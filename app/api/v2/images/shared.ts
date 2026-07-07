import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";
import { getApiAuth } from "@/utils/supabase/api";

// Licenses we accept into the bank: public domain or attribution-style only.
// These are Openverse license slugs.
export const ALLOWED_LICENSES = ["cc0", "by", "by-sa"] as const;

export function isAllowedLicense(license: unknown): license is (typeof ALLOWED_LICENSES)[number] {
  return typeof license === "string" && (ALLOWED_LICENSES as readonly string[]).includes(license);
}

// Curating the image bank is admin/reviewer work. The bank has no per-user
// rows (RLS only grants SELECT), and the words-without-images listing spans
// every user's custom words, so after the role check both reads and writes
// go through the service role.
export async function getImageBankAccess(
  req: Request
): Promise<{ error: string; status: number } | { serviceClient: SupabaseClient }> {
  const { supabase, user } = await getApiAuth(req);
  if (!user) {
    return { error: "Authentication required", status: 401 };
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (roleData?.role !== "admin" && roleData?.role !== "reviewer") {
    return { error: "Admin or reviewer role required", status: 403 };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: "Server configuration error", status: 500 };
  }

  return {
    serviceClient: createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
