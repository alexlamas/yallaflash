"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { apiJSON } from "@/app/v2/lib/api";
import { DEFAULT_TUTOR_INSTRUCTIONS } from "@/app/v2/lib/tutorPrompt";
import { InstructionsEditor } from "@/app/v2/components/InstructionsEditor";
import { V2Gate } from "@/app/v2/components/V2Gate";

// The permanent surface for the tutor's editable memory -- what new users
// see at onboarding, existing users find here (menu -> Coaching).
export default function CoachingPage() {
  return (
    <V2Gate>
      <CoachingContent />
    </V2Gate>
  );
}

function CoachingContent() {
  const [instructions, setInstructions] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // POST {} reads the current effective instructions (defaults until the
    // user customizes); fall back to the defaults if the read fails.
    apiJSON<{ instructions: string }>("/api/v2/settings", {})
      .then((data) => {
        if (!cancelled) setInstructions(data.instructions || DEFAULT_TUTOR_INSTRUCTIONS);
      })
      .catch(() => {
        if (!cancelled) setInstructions(DEFAULT_TUTOR_INSTRUCTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-[100dvh] bg-gradient-to-b from-green-50/60 via-white to-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
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
        {instructions !== null && <InstructionsEditor initial={instructions} standalone />}
      </main>
    </div>
  );
}
