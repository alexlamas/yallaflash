"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { track } from "@/app/v2/lib/analytics";
import type { Widget } from "@/app/v2/lib/types";

// Only the aggregate is known ({reviewed, correct}), so the bar shows
// proportion, not per-word order: `correct` green cells, then misses.
const MAX_CELLS = 12;

function headline(reviewed: number, correct: number): string {
  if (reviewed === 0) return "Session done";
  const ratio = correct / reviewed;
  if (ratio === 1) return "Yalla! Clean sweep";
  if (ratio >= 0.7) return "Solid session";
  if (ratio >= 0.4) return "Getting there";
  return "Tough round -- they'll come back around";
}

export function SessionSummary({ widget }: { widget: Extract<Widget, { type: "session_summary" }> }) {
  const { reviewed, correct } = widget;
  const cells = reviewed > 0 && reviewed <= MAX_CELLS ? reviewed : 0;
  const [rated, setRated] = useState<"up" | "down" | null>(null);

  const rate = (rating: "up" | "down") => {
    if (rated) return;
    setRated(rating);
    track("v2_session_rated", { rating, reviewed, correct });
  };

  return (
    <Card className="w-full max-w-md mx-auto rounded-2xl">
      <CardContent className="p-5 text-center space-y-3">
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-subtle">
          Session complete
        </div>
        <div>
          <div className="text-heading">
            <span className="text-4xl font-title tabular-nums">{correct}</span>
            <span className="text-lg text-subtle tabular-nums"> / {reviewed}</span>
          </div>
          <div className="text-sm text-subtle mt-1">{headline(reviewed, correct)}</div>
        </div>
        {cells > 0 ? (
          <div
            className="flex gap-1 justify-center"
            role="img"
            aria-label={`${correct} of ${reviewed} correct`}
          >
            {Array.from({ length: cells }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 max-w-[1.75rem] rounded-full",
                  i < correct ? "bg-green-500" : "bg-red-200"
                )}
              />
            ))}
          </div>
        ) : reviewed > 0 ? (
          <div
            className="h-1.5 rounded-full bg-red-200 overflow-hidden"
            role="img"
            aria-label={`${correct} of ${reviewed} correct`}
          >
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${Math.round((correct / reviewed) * 100)}%` }}
            />
          </div>
        ) : null}
        {/* One-tap session rating: the loop's qualitative signal. Quiet by
            design -- skippable, no follow-up, thanks and done. */}
        <div className="pt-1 border-t border-gray-100">
          {rated ? (
            <div className="text-xs text-subtle pt-2">Noted -- thanks!</div>
          ) : (
            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-subtle">
              How was this session?
              <button
                onClick={() => rate("up")}
                aria-label="Good session"
                className="relative h-7 w-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-green-600 hover:border-green-300 hover:bg-green-50 transition-[color,background-color,border-color,transform] active:scale-[0.96] before:absolute before:-inset-1.5 before:content-['']"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => rate("down")}
                aria-label="Rough session"
                className="relative h-7 w-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-[color,background-color,border-color,transform] active:scale-[0.96] before:absolute before:-inset-1.5 before:content-['']"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
