"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Renders the optional sentence wrapped around a review card: the tested
// word gets highlighted on recognition cards, and cloze blanks ("____",
// already substituted server-side) are drawn as a real gap. The answer never
// passes through here -- recognition context arrives without a translation,
// and cloze context arrives with the word already blanked out.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderBlanks(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(_{3,})/).map((part, i) =>
    /^_{3,}$/.test(part) ? (
      // The gap is a quiet tinted slot, not a dashed line -- it should read
      // as a place where a word goes, like a rounded selection highlight.
      <span
        key={`${keyPrefix}-${i}`}
        aria-label="blank"
        className="mx-0.5 inline-block h-[1.05em] min-w-14 translate-y-[0.18em] rounded-md bg-current opacity-[0.13]"
      />
    ) : (
      part
    )
  );
}

export function ContextSentence({
  text,
  translation,
  highlight,
  className,
  highlightClassName,
  large = false,
}: {
  text: string;
  translation?: string | null;
  highlight?: string | null;
  className?: string;
  highlightClassName?: string;
  // Cloze cards make the sentence the headline -- bigger type, roomier
  // translation.
  large?: boolean;
}) {
  let body: ReactNode[];
  if (highlight?.trim()) {
    const parts = text.split(new RegExp(`(${escapeRegExp(highlight.trim())})`, "i"));
    // Odd indexes are the captured matches; everything else may carry blanks.
    body = parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className={highlightClassName}>
          {part}
        </span>
      ) : (
        renderBlanks(part, String(i))
      )
    );
  } else {
    body = renderBlanks(text, "b");
  }

  return (
    <div className={cn(large ? "space-y-2" : "space-y-1", className)}>
      <div className={cn("leading-relaxed", large ? "text-xl" : "text-base")}>{body}</div>
      {translation && (
        <div className={cn("italic opacity-80", large ? "text-sm" : "text-xs")}>{translation}</div>
      )}
    </div>
  );
}
