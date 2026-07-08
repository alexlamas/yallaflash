"use client";

import { cn } from "@/lib/utils";

// The honest exit, on the card itself: reveals the answer as a conceded
// miss. Quiet text rather than a button -- guessing an option or asking for
// a hint should still read as the primary moves.
export function IDontKnow({ onConcede, className }: { onConcede?: () => void; className?: string }) {
  if (!onConcede) return null;
  return (
    <button
      onClick={onConcede}
      className={cn(
        "mx-auto block text-xs underline-offset-4 hover:underline pt-1 transition-colors",
        className
      )}
    >
      I don&apos;t know
    </button>
  );
}
