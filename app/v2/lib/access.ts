import type { SupabaseClient } from "@supabase/supabase-js";

// V2 is gated while it bakes: only admins (i.e. Alex) get the chat-native
// experience on production. Everyone else keeps V1 untouched. Flip by
// granting the admin role, or delete this gate when V2 becomes the default.
export async function hasV2Access(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((row) => row.role === "admin");
}
