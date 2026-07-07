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
      <span
        key={`${keyPrefix}-${i}`}
        aria-label="blank"
        className="inline-block min-w-12 border-b-2 border-dashed border-current opacity-50 align-middle"
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
}: {
  text: string;
  translation?: string | null;
  highlight?: string | null;
  className?: string;
  highlightClassName?: string;
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
    <div className={cn("space-y-1", className)}>
      <div className="text-base leading-relaxed">&ldquo;{body}&rdquo;</div>
      {translation && <div className="text-xs italic opacity-80">{translation}</div>}
    </div>
  );
}
