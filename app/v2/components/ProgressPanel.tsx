"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { climbPercent, levelForProgress } from "@/app/v2/lib/levels";
import type { ProgressState } from "@/app/v2/lib/types";

export interface ProgressWord {
  id: string;
  arabizi: string;
  english: string;
  status: ProgressState;
  interval: number;
  ease_factor: number;
  review_count: number;
  next_review_date: string;
  updated_at: string;
}

export interface ProgressData {
  counts: { new: number; learning: number; learned: number; dueNow: number };
  words: ProgressWord[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">{children}</div>
  );
}

// ---------------------------------------------------------------------------
// The climb: one big number for altitude, one stacked band for what the
// collection is made of -- in the same colors the review cards wear, summit
// on the left. High-level first; the legend is the tap-in detail. (The old
// "slipping away" word list is gone: the review queue already serves the
// most-overdue words first, so it duplicated what Next word does.)
// ---------------------------------------------------------------------------

// Summit first. Swatches echo the card flavors (night / classic green /
// sand / mint / sky) so the panel and the cards speak one color language.
const RUNGS: { level: number; label: string; hint: string; swatch: string }[] = [
  { level: 5, label: "solid", hint: "long-haul memory", swatch: "bg-gray-800" },
  { level: 4, label: "producing", hint: "typed from memory", swatch: "bg-green-500" },
  { level: 3, label: "recalling", hint: "typed the meaning", swatch: "bg-amber-300" },
  { level: 2, label: "building", hint: "assembled from tiles", swatch: "bg-emerald-300" },
  { level: 1, label: "recognizing", hint: "picked from options", swatch: "bg-emerald-200" },
  { level: 0, label: "new", hint: "just met", swatch: "bg-sky-300" },
];

function ClimbSection({ data, onPrompt }: { data: ProgressData; onPrompt: (text: string) => void }) {
  const counts = useMemo(() => {
    const perLevel = [0, 0, 0, 0, 0, 0];
    for (const word of data.words) perLevel[levelForProgress(word)] += 1;
    return perLevel;
  }, [data.words]);
  const total = data.words.length;

  if (total === 0) {
    return (
      <section>
        <SectionLabel>The climb</SectionLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-subtle">
          Add words or start a pack, and your climb up the ladder starts here.
        </p>
      </section>
    );
  }

  const percent = climbPercent(data.words);
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <SectionLabel>The climb</SectionLabel>
        {/* The whole collection, one click away -- the count IS the link. */}
        <Link
          href="/words"
          className="text-[10px] font-mono text-subtle tabular-nums hover:text-green-700 transition-colors"
        >
          all {total} →
        </Link>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-title text-5xl leading-none text-heading tabular-nums">{percent}%</span>
        <span className="text-[11px] font-mono text-subtle">of the climb</span>
      </div>
      {/* Composition band, summit-first: the dark mass growing from the left
          IS the progress; the sky at the right edge is what's still ahead. */}
      <div className="mt-3 flex h-2.5 w-full rounded-full overflow-hidden bg-gray-200/60">
        {RUNGS.map(
          (rung) =>
            counts[rung.level] > 0 && (
              <div
                key={rung.label}
                className={cn("h-full transition-[width] duration-700", rung.swatch)}
                style={{ width: `${(counts[rung.level] / total) * 100}%` }}
              />
            )
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
        {RUNGS.filter((rung) => counts[rung.level] > 0).map((rung) => (
          <button
            key={rung.label}
            onClick={() =>
              onPrompt(
                `Show me my "${rung.label}" words — the ones at rung ${rung.level} of the ladder (${rung.hint}).`
              )
            }
            aria-label={`${counts[rung.level]} ${rung.label} words — ask the tutor about them`}
            className="flex items-center gap-1.5 rounded text-[11px] font-mono text-body hover:text-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            <span aria-hidden className={cn("h-2 w-2 rounded-full", rung.swatch)} />
            <span className="tabular-nums">{counts[rung.level]}</span>
            {rung.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats: three time horizons -- waiting now, done today, learned ever
// ---------------------------------------------------------------------------

// No retention estimate here: it's a model number, not an answer to any
// question the learner has. Due (the queue draining live as you review),
// today (effort), learned (long-term progress) each carry one horizon.
function Stats({ data }: { data: ProgressData }) {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const reviewedToday = data.words.filter(
    (w) => w.review_count > 0 && new Date(w.updated_at).getTime() >= todayStart
  ).length;

  return (
    <section className="mt-auto grid grid-cols-3 shrink-0 pt-6">
      <div>
        <div className="font-mono text-[15px] tabular-nums text-heading leading-6">{data.counts.dueNow}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-0.5">Due</div>
      </div>
      <div>
        <div className="font-mono text-[15px] tabular-nums text-heading leading-6">{reviewedToday}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-0.5">Today</div>
      </div>
      <div>
        <div className="font-mono text-[15px] tabular-nums text-heading leading-6">{data.counts.learned}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-0.5">Learned</div>
      </div>
    </section>
  );
}

// Data is fetched once by the chat shell and shared between the desktop
// sidebar and the mobile drawer, so the drawer never opens onto a spinner.
// onPrompt sends the given text to the tutor chat (and closes the drawer on
// mobile) -- every element in the panel is a door into the chat.
//
// The panel is deliberately chromeless AND passive: quiet type sitting
// directly on the page background -- no cards, dividers, or buttons.
// Actions live in the chat (the session hero and the chips bar); putting a
// call-to-action here too meant two buttons for the same thing on screen.
export function ProgressPanel({
  data,
  onPrompt,
}: {
  data: ProgressData | null;
  onPrompt?: (text: string) => void;
}) {
  if (!data) {
    // Structural skeleton mirroring the panel's sections, so the drawer
    // opens onto the panel's shape instead of a bare loading string.
    return (
      <div className="flex flex-col h-full px-5 py-6 gap-7" aria-busy="true" aria-label="Loading progress">
        <div className="space-y-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-auto grid grid-cols-3 gap-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
    );
  }

  const send = onPrompt ?? (() => {});

  return (
    <div className="flex flex-col h-full overflow-y-auto px-5 py-6 gap-7">
      <ClimbSection data={data} onPrompt={send} />
      <Stats data={data} />
    </div>
  );
}
