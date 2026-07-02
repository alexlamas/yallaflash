import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ChatWindow } from "@/app/v2/components/ChatWindow";

export default async function ChatPage() {
  // A logged-out visitor (shared link, expired session) gets the landing
  // page with its signup CTA instead of a raw 401 error banner.
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <ChatWindow />;
}
