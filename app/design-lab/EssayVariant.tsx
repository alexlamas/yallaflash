"use client";

// Variant Q — "The essay"
// Pudding technique #1: the data lives inside the prose. The hero is a
// tiny visual essay — an editorial lede in PP Hatton, then a sentence
// where the numbers are typeset as data and the at-risk words appear
// inline as tappable ghosts. Reads like the opening of a story about you.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, sampleVocab, weakestFirst, minutesFor } from "./fixtures";
import { Card, Eyebrow, MissionChassis, DetailRow, type SpotWord } from "./chassis";

function Num({ value, tone }: { value: number; tone?: "amber" | "green" }) {
  return (
    <span
      className={cn(
        "font-mono font-semibold tabular-nums px-1 py-0.5 rounded",
        tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-green-50 text-green-700" : "text-heading"
      )}
    >
      {value}
    </span>
  );
}

export function EssayVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [sel, setSel] = useState<SpotWord | null>(null);
  const isBacklog = data.dueNow > 20;
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  // The three most-recently-slipped words, named in the prose itself.
  const ghosts: SpotWord[] = (isBacklog
    ? weakestFirst(data.words).filter((w) => w.dueInDays < -0.5).slice(-3)
    : weakestFirst(data.words).slice(0, 3)
  ).map((w) => ({
    arabizi: w.arabizi,
    english: w.english,
    note: isBacklog ? `slipped ${Math.round(-w.dueInDays)} days ago` : "your weakest right now",
  }));
  const fresh = sampleVocab(2, `${data.key}essay`);

  const GhostWord = ({ w }: { w: SpotWord }) => (
    <button
      onMouseEnter={() => setSel(w)}
      onClick={() => setSel(w)}
      className={cn(
        "italic rounded-sm transition-[filter,opacity,color] duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        sel?.arabizi === w.arabizi
          ? "text-green-700 opacity-100 blur-0"
          : isBacklog
          ? "text-gray-500 opacity-40 blur-[1.2px]"
          : "text-amber-700 opacity-80 blur-[0.4px]"
      )}
    >
      {w.arabizi}
    </button>
  );

  const hero = (
    <Card onMouseLeave={() => setSel(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right="your story so far">Chapter {isBacklog ? "2: the quiet" : "3: the streak"}</Eyebrow>
      </div>
      <div className="px-4 pt-3 pb-1">
        <h3 className="font-title font-medium text-[19px] leading-snug text-heading">
          {isBacklog ? "Your Lebanese went quiet in July." : "Your Lebanese is wide awake."}
        </h3>
        <p className="mt-2.5 text-[13px] leading-[1.75] text-body">
          You&apos;ve met <Num value={total} /> words so far.{" "}
          {isBacklog ? (
            <>
              <Num value={total - data.dueNow - data.counts.new} tone="green" /> are still holding on — but{" "}
              <Num value={data.dueNow} tone="amber" /> went quiet while you were away, most recently{" "}
              <GhostWord w={ghosts[0]} />, <GhostWord w={ghosts[1]} /> and <GhostWord w={ghosts[2]} />.
            </>
          ) : (
            <>
              <Num value={data.counts.learned} tone="green" /> are solid, your streak is{" "}
              <Num value={data.streak} /> days old, and only <GhostWord w={ghosts[0]} />,{" "}
              <GhostWord w={ghosts[1]} /> and <GhostWord w={ghosts[2]} /> are wobbling.
            </>
          )}
        </p>
        <p className="mt-2 text-[13px] leading-[1.75] text-body">
          {isBacklog ? (
            <>
              The good news: <Num value={10} /> words and{" "}
              <span className="font-medium text-heading">{minutesFor(10)} minutes</span> turn the page.
            </>
          ) : (
            <>
              Tonight&apos;s chapter: <Num value={Math.max(data.dueNow, 3)} /> quick words — then maybe meet{" "}
              <span className="italic text-subtle">{fresh[0][0]}</span> and{" "}
              <span className="italic text-subtle">{fresh[1][0]}</span>?
            </>
          )}
        </p>
      </div>
      <DetailRow
        word={sel}
        onAction={onAction}
        hint={
          <>
            <span>
              the numbers are live — and the <span className="italic">italic ghosts</span> are real words
            </span>
            <span className="ml-auto text-disabled shrink-0">tap one</span>
          </>
        }
      />
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
