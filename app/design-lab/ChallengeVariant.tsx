"use client";

// Variant S — "Pop quiz"
// Pudding technique #3: make the reader participate before you explain.
// Three of your own words, blurred to exactly how well you know them.
// "Can you still read these?" — if you can't, that IS the diagnosis, and
// the tap that checks is the same tap that starts fixing it.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, weakestFirst, retention } from "./fixtures";
import { Card, Eyebrow, MissionChassis, DetailRow, type SpotWord } from "./chassis";

export function ChallengeVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<SpotWord | null>(null);
  const isBacklog = data.dueNow > 20;

  const candidates = weakestFirst(data.words).filter((w) => w.reviewCount > 0 || w.dueInDays < -0.5);
  const three = isBacklog ? candidates.slice(-3).reverse() : candidates.slice(0, 3);
  const remaining = Math.max(0, data.dueNow - 3);

  const hero = (
    <Card onMouseLeave={() => setSel(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right="blur = your actual recall">Pop quiz</Eyebrow>
      </div>
      <div className="px-4 pt-3">
        <h3 className="font-title font-medium text-[19px] leading-snug text-heading">
          Can you still read these?
        </h3>
        <div className="mt-3 flex flex-col gap-1.5">
          {three.map((w) => {
            const isRevealed = revealed.has(w.id);
            const r = retention(w);
            const overdue = w.dueInDays < -0.5;
            const blur = isRevealed ? 0 : overdue ? 2.6 : r !== null && r < 0.45 ? 1.4 : 0.7;
            return (
              <button
                key={w.id}
                onClick={() => {
                  setRevealed((s) => new Set(s).add(w.id));
                  setSel({
                    arabizi: w.arabizi,
                    english: w.english,
                    note: overdue
                      ? `that blur was real — asleep ${Math.round(-w.dueInDays)}d`
                      : `hanging on at ${Math.round((r ?? 0) * 100)}%`,
                  });
                }}
                className={cn(
                  "flex items-baseline justify-between rounded-lg px-3 py-2 min-h-[44px] text-left",
                  "hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
                )}
              >
                <span
                  className={cn(
                    "text-[21px] font-medium transition-[filter,opacity,color] duration-500",
                    isRevealed ? "text-green-700 opacity-100" : "text-gray-700 opacity-60"
                  )}
                  style={{ filter: `blur(${blur}px)` }}
                >
                  {w.arabizi}
                </span>
                <span
                  className={cn(
                    "text-xs transition-opacity duration-500",
                    isRevealed ? "text-subtle opacity-100" : "opacity-0"
                  )}
                >
                  {isRevealed ? w.english : "?"}
                </span>
              </button>
            );
          })}
        </div>
        {remaining > 0 && (
          <p className="mt-2 px-1 text-[11px] text-subtle">
            …and <span className="font-semibold text-amber-600 tabular-nums">{remaining} more</span> are
            blurring like this while we talk.
          </p>
        )}
      </div>
      <DetailRow
        word={sel}
        onAction={onAction}
        hint={
          <>
            <span>the blur is honest — it&apos;s your recall, rendered</span>
            <span className="ml-auto text-disabled shrink-0">tap to check yourself</span>
          </>
        }
      />
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
