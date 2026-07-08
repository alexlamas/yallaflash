"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Ebbinghaus-style retention estimate: R = e^(-t/S), where t is time since
// the last review and S is the word's current interval. Hits ~37% exactly
// when the word comes due -- which is the point of the schedule.
function retentionNow(word: ProgressWord, now: number): number | null {
  if (word.review_count === 0) return null;
  const stability = Math.max(word.interval, 1 / 24);
  const elapsedDays = Math.max(0, now - new Date(word.updated_at).getTime()) / DAY_MS;
  return Math.exp(-elapsedDays / stability);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">{children}</div>
  );
}

// ---------------------------------------------------------------------------
// Slipping words: only the words that need the user
// ---------------------------------------------------------------------------

// The panel used to typeset the user's whole vocabulary; in situ the strong
// words were 40 lines of bold ink shouting over the conversation. Only words
// that need attention earn sidebar space now: everything due (most recently
// slipped first), then the not-yet-due words closest to the fold.
const SLIPPING_SHOWN = 8;

function slippingWords(words: ProgressWord[], now: number): ProgressWord[] {
  const due = words
    .filter((w) => new Date(w.next_review_date).getTime() <= now)
    .sort(
      (a, b) => new Date(b.next_review_date).getTime() - new Date(a.next_review_date).getTime()
    );
  const fading = words
    .map((w) => ({ w, r: retentionNow(w, now) }))
    .filter(
      (x): x is { w: ProgressWord; r: number } =>
        x.r !== null && x.r < 0.45 && new Date(x.w.next_review_date).getTime() > now
    )
    .sort((a, b) => a.r - b.r)
    .map((x) => x.w);
  return [...due, ...fading];
}

function SlippingSection({ data, onPrompt }: { data: ProgressData; onPrompt: (text: string) => void }) {
  // Recompute only when fresh data lands, never on the clock tick -- the
  // panel holding still matters more than second-level decay accuracy.
  const { shown, hidden } = useMemo(() => {
    const all = slippingWords(data.words, Date.now());
    return { shown: all.slice(0, SLIPPING_SHOWN), hidden: Math.max(0, all.length - SLIPPING_SHOWN) };
  }, [data.words]);
  const startedTotal = data.counts.learning + data.counts.learned;

  if (data.words.length === 0) {
    return (
      <section>
        <SectionLabel>Your words</SectionLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-subtle">
          Add words or start a pack, and the ones that need a refresh will gather here.
        </p>
      </section>
    );
  }

  // Nothing slipping: one quiet line instead of a wall of words you already
  // know -- the strongest state of the panel is the emptiest.
  if (shown.length === 0) {
    return (
      <section>
        <SectionLabel>Your words</SectionLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-subtle">
          All {startedTotal} holding strong.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <SectionLabel>Slipping away</SectionLabel>
        {hidden > 0 && (
          <span className="text-[10px] font-mono text-disabled tabular-nums">+{hidden} more</span>
        )}
      </div>
      {/* Padding (not flex gap) provides the spacing, so tap targets tile
          with no dead space; -mx keeps the text optically flush left. */}
      <div className="mt-1 -mx-1.5 flex flex-wrap">
        {shown.map((w) => (
          <button
            key={w.id}
            onClick={() => onPrompt(`Quiz me on "${w.arabizi}"`)}
            aria-label={`Quiz me on ${w.arabizi}`}
            className="px-1.5 py-1 text-[13px] leading-5 text-body rounded-md transition-[color,transform] hover:text-green-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
          >
            {w.arabizi}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] font-mono text-disabled">tap a word to wake it</p>
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
// mobile) -- every word in the panel is a door into the chat.
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
          <Skeleton className="h-4 w-5/6" />
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
      <SlippingSection data={data} onPrompt={send} />
      <Stats data={data} />
    </div>
  );
}
