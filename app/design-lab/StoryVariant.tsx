"use client";

// Variant T — "Three beats"
// Pudding technique #4: scrollytelling — the same graphic re-read three
// times with a changing sentence. Compressed into a panel-sized stepper:
// one word-wall, three beats (what you have → what went quiet → the way
// back), the wall restyling itself under each line.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, sampleKinds, sampleVocab, minutesFor, type SampleKind } from "./fixtures";
import { Card, Eyebrow, MissionChassis, DetailRow, type SpotWord } from "./chassis";

const SHOWN = 24;

export function StoryVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [beat, setBeat] = useState(0);
  const [sel, setSel] = useState<SpotWord | null>(null);
  const isBacklog = data.dueNow > 20;
  const total = data.counts.new + data.counts.learning + data.counts.learned;

  const kinds = sampleKinds(data, SHOWN, "story");
  const vocab = sampleVocab(SHOWN, `${data.key}storyv`);
  const words = kinds.map((kind, i) => ({ i, arabizi: vocab[i][0], english: vocab[i][1], kind }));
  const rescue = words.filter((w) => w.kind === "asleep").slice(0, 3);

  const beats = [
    {
      line: (
        <>
          You&apos;ve built a vocabulary of{" "}
          <span className="font-mono font-semibold text-heading tabular-nums">{total}</span> words.
        </>
      ),
      // beat 0: everything rendered at full strength — what you own
      style: () => "text-gray-900 opacity-100",
    },
    {
      line: isBacklog ? (
        <>
          <span className="font-mono font-semibold text-amber-600 tabular-nums">{data.dueNow}</span> of them
          went quiet while you were away.
        </>
      ) : (
        <>
          Only <span className="font-mono font-semibold text-amber-600 tabular-nums">{data.dueNow}</span> are
          wobbling right now.
        </>
      ),
      // beat 2: honesty — the quiet ones fade, the rest hold
      style: (kind: SampleKind) =>
        kind === "asleep" ? "text-gray-400 opacity-25 blur-[1.6px]" : "text-gray-900 opacity-90",
    },
    {
      line: (
        <>
          <span className="font-mono font-semibold text-green-700 tabular-nums">
            {Math.min(10, Math.max(1, data.dueNow))}
          </span>{" "}
          words · {minutesFor(Math.min(10, Math.max(1, data.dueNow)))} min — and these three come back first.
        </>
      ),
      // beat 3: hope — the rescue set relights, the rest recede
      style: (kind: SampleKind, i: number) =>
        rescue.some((r) => r.i === i)
          ? "text-green-700 opacity-100 font-semibold"
          : kind === "asleep"
          ? "text-gray-400 opacity-20 blur-[1.6px]"
          : "text-gray-500 opacity-45",
    },
  ];

  const hero = (
    <Card onMouseLeave={() => setSel(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`beat ${beat + 1} of 3`}>Your month, in three beats</Eyebrow>
      </div>
      <div className="px-4 pt-3 min-h-[54px]">
        <p className="text-[13.5px] leading-relaxed text-body">{beats[beat].line}</p>
      </div>
      <div className="px-4 pt-2 pb-1 select-none">
        <div className="flex flex-wrap items-baseline gap-x-[9px] gap-y-[3px]">
          {words.map((w) => (
            <button
              key={w.i}
              onMouseEnter={() => setSel({ arabizi: w.arabizi, english: w.english, note: w.kind === "asleep" ? "one of the quiet ones" : "holding on" })}
              onClick={() =>
                setSel({ arabizi: w.arabizi, english: w.english, note: w.kind === "asleep" ? "one of the quiet ones" : "holding on" })
              }
              className={cn(
                "text-[13.5px] leading-6 font-medium rounded-sm transition-all duration-500",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
                sel?.arabizi === w.arabizi ? "text-green-700 opacity-100 blur-0" : beats[beat].style(w.kind, w.i)
              )}
            >
              {w.arabizi}
            </button>
          ))}
        </div>
      </div>
      {/* pager */}
      <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
        {[0, 1, 2].map((b) => (
          <button
            key={b}
            onClick={() => setBeat(b)}
            aria-label={`Beat ${b + 1}`}
            aria-current={beat === b}
            className={cn(
              "h-6 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
              beat === b ? "w-8 bg-green-600" : "w-6 bg-gray-200 hover:bg-gray-300"
            )}
            style={{ height: 6, marginTop: 8, marginBottom: 8 }}
          />
        ))}
        <button
          onClick={() => (beat < 2 ? setBeat(beat + 1) : onAction("Start a rescue session with my 10 weakest words"))}
          className="ml-auto h-8 px-3 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-50 active:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
        >
          {beat < 2 ? "next →" : "yalla →"}
        </button>
      </div>
      <DetailRow
        word={sel}
        onAction={onAction}
        hint={
          <>
            <span>same wall, three readings — tap the dots</span>
            <span className="ml-auto text-disabled shrink-0">hover a word</span>
          </>
        }
      />
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
