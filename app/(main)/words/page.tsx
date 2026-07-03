import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WordsTable } from "@/app/v2/components/WordsTable";

export default async function WordsPage() {
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <WordsTable />;
}
