"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatCountdown(ms: number): string {
  if (ms >= DAY_MS) {
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / 3_600_000);
    return `T−${days}d ${String(hours).padStart(2, "0")}h`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `T−${h}:${m}:${s}`;
}

function minutesFor(count: number): number {
  return Math.max(1, Math.round(count * 0.4));
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
// Next action + stats
// ---------------------------------------------------------------------------

function NextAction({
  data,
  now,
  onPrompt,
}: {
  data: ProgressData;
  now: number;
  onPrompt: (text: string) => void;
}) {
  const dueNow = data.counts.dueNow;
  const isBacklog = dueNow > 20;
  const bite = Math.min(10, Math.max(1, dueNow));
  const daysToClear = Math.max(1, Math.ceil(dueNow / 25));
  const upcoming = data.words
    .map((w) => new Date(w.next_review_date).getTime() - now)
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)[0];

  return (
    <section className="shrink-0">
      <SectionLabel>{isBacklog ? "Recovery plan" : "Next up"}</SectionLabel>
      {isBacklog ? (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-body">
            <span className="font-semibold text-heading tabular-nums">{dueNow} words</span> went quiet while
            you were away. 25 a day wakes them all in{" "}
            <span className="font-semibold text-heading tabular-nums">{daysToClear} days</span>.
          </p>
          <button
            onClick={() => onPrompt(`Start a rescue session with my ${bite} weakest words`)}
            className="mt-3 w-full h-11 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 transition-colors"
          >
            Wake the {bite} weakest · {minutesFor(bite)} min
          </button>
          <button
            onClick={() => onPrompt("Start a full review session")}
            className="mt-1.5 w-full h-10 rounded-lg text-[13px] font-medium text-subtle hover:bg-black/[0.04] active:bg-black/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
          >
            I have time -- full session ({minutesFor(25)} min)
          </button>
        </>
      ) : dueNow > 0 ? (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-body">
            <span className="font-semibold text-heading tabular-nums">
              {dueNow} {dueNow === 1 ? "word" : "words"} due
            </span>{" "}
            -- a quick one before they fade.
          </p>
          <button
            onClick={() => onPrompt(`Review my ${dueNow} due ${dueNow === 1 ? "word" : "words"}`)}
            className="mt-3 w-full h-11 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 transition-colors"
          >
            Clear {dueNow === 1 ? "it" : "them"} · {minutesFor(dueNow)} min
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-body">
            All clear.{" "}
            {upcoming !== undefined ? (
              <>
                Next review in{" "}
                <span className="font-mono text-heading tabular-nums">{formatCountdown(upcoming)}</span> -- get
                ahead:
              </>
            ) : (
              <>Get ahead:</>
            )}
          </p>
          <button
            onClick={() => onPrompt("Teach me 3 new words")}
            className="mt-3 w-full h-11 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 transition-colors"
          >
            Learn 3 new words · 2 min
          </button>
        </>
      )}
    </section>
  );
}

function Stats({ data, now }: { data: ProgressData; now: number }) {
  const reviewed = data.words.filter((w) => w.review_count > 0);
  const retentions = reviewed
    .map((w) => retentionNow(w, now))
    .filter((r): r is number => r !== null);
  const meanRetention =
    retentions.length > 0 ? retentions.reduce((a, b) => a + b, 0) / retentions.length : null;
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const reviewedToday = reviewed.filter((w) => new Date(w.updated_at).getTime() >= todayStart).length;

  return (
    <section className="mt-auto grid grid-cols-3 shrink-0 pt-6">
      <div>
        <div className="font-mono text-[15px] tabular-nums text-heading leading-6">{reviewedToday}</div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-0.5">Today</div>
      </div>
      <div>
        <div className="font-mono text-[15px] tabular-nums text-heading leading-6">
          {meanRetention === null ? "--" : `${Math.round(meanRetention * 100)}%`}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-0.5">Retention</div>
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
// mobile) -- every word and button in the panel is a door into the chat.
//
// The panel is deliberately chromeless: quiet type sitting directly on the
// page background, no cards, borders, or dividers. Cards belong to the
// conversation (review widgets, the composer); ambient status shouldn't
// compete with them.
export function ProgressPanel({
  data,
  onPrompt,
  reviewing = false,
}: {
  data: ProgressData | null;
  onPrompt?: (text: string) => void;
  /** true while a review card or verdict is on screen -- the panel goes
   * quiet: no competing call-to-action, the words and stats hold still. */
  reviewing?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  // Live tick: drives the countdown and the retention estimate.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data) {
    // Structural skeleton mirroring the panel's sections, so the drawer
    // opens onto the panel's shape instead of a bare loading string.
    return (
      <div className="flex flex-col h-full px-5 py-6 gap-7" aria-busy="true" aria-label="Loading progress">
        <div className="space-y-2.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
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
      {!reviewing && <NextAction data={data} now={now} onPrompt={send} />}
      <SlippingSection data={data} onPrompt={send} />
      <Stats data={data} now={now} />
    </div>
  );
}
