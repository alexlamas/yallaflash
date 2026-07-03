import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hasV2Access } from "@/app/v2/lib/access";
import { WordsTable } from "@/app/v2/components/WordsTable";

export default async function WordsPage() {
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await hasV2Access(supabase, user.id))) redirect("/");

  return <WordsTable />;
}
