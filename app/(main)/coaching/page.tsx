import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_TUTOR_INSTRUCTIONS } from "@/app/v2/lib/tutorPrompt";
import { InstructionsEditor } from "@/app/v2/components/InstructionsEditor";

// The permanent surface for the tutor's editable memory -- what new users
// see at onboarding, existing users find here (menu -> Coaching).
export default async function CoachingPage() {
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: settings } = await supabase
    .from("v2_user_settings")
    .select("tutor_instructions")
    .eq("user_id", user.id)
    .maybeSingle();
  const instructions = settings?.tutor_instructions?.trim() || DEFAULT_TUTOR_INSTRUCTIONS;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-green-50/60 via-white to-white">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
        <Link
          href="/chat"
          aria-label="Back to chat"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-heading"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Image src="/logo.svg" alt="" width={22} height={22} />
        <h1 className="font-title text-xl">Coaching</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4">
        <p className="text-sm text-subtle">
          These standing instructions are the tutor&apos;s memory of how you like to be coached. It reads
          them on every message, and rewrites them itself when you ask for a lasting change (&quot;skip the
          root explanations&quot;). Edit them directly here.
        </p>
        <InstructionsEditor initial={instructions} standalone />
      </main>
    </div>
  );
}
