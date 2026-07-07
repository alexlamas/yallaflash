"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
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

// ---------------------------------------------------------------------------
// The fold: your words in memory order
// ---------------------------------------------------------------------------

type WordKind = "strong" | "ok" | "fading" | "asleep";

// Fade encodes memory: font weight first (a precise typographic channel),
// opacity second, blur last and capped so ghosts read intentional.
const KIND_STYLE: Record<WordKind, string> = {
  strong: "font-semibold text-gray-900",
  ok: "font-normal text-gray-800 opacity-90",
  fading: "font-light text-gray-600 opacity-70 blur-[0.4px]",
  asleep: "font-light text-gray-500 opacity-35 blur-[1.4px]",
};

const KIND_LABEL: Record<WordKind, string> = {
  strong: "bold in your memory",
  ok: "settled",
  fading: "losing weight -- review soon",
  asleep: "below the fold -- review to lift it back",
};

interface FoldWord {
  word: ProgressWord;
  kind: WordKind;
}

const FOLD_SHOWN = 40;
const ASLEEP_SLOTS = 16;

// Curated, not proportional: the words that need you get guaranteed slots.
// Every due word makes the page (up to a cap, most recently slipped first),
// then the strongest fill the rest as backdrop -- so the fold surfaces what
// matters whether you have 50 words or 5000.
function buildFold(words: ProgressWord[], now: number): FoldWord[] {
  const classified = words
    .filter((w) => w.review_count > 0 || new Date(w.next_review_date).getTime() <= now)
    .map((w) => {
      const due = new Date(w.next_review_date).getTime() <= now;
      const r = retentionNow(w, now) ?? 0;
      const kind: WordKind = due ? "asleep" : r > 0.75 ? "strong" : r > 0.45 ? "ok" : "fading";
      return { word: w, kind, r };
    });

  const asleep = classified
    .filter((c) => c.kind === "asleep")
    .sort((a, b) => new Date(b.word.next_review_date).getTime() - new Date(a.word.next_review_date).getTime())
    .slice(0, ASLEEP_SLOTS);
  const awake = classified
    .filter((c) => c.kind !== "asleep")
    .sort((a, b) => b.r - a.r)
    .slice(0, FOLD_SHOWN - asleep.length);

  // Reading order is the axis: strongest ink first, ghosts last.
  return [...awake, ...asleep];
}

function FoldCard({
  data,
  now,
  onPrompt,
}: {
  data: ProgressData;
  now: number;
  onPrompt: (text: string) => void;
}) {
  const [hovered, setHovered] = useState<FoldWord | null>(null);
  const fold = buildFold(data.words, now);
  const foldAt = fold.findIndex((f) => f.kind === "asleep");
  const startedTotal = data.counts.learning + data.counts.learned;

  if (fold.length === 0) {
    return (
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-4">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">Your words</div>
        <p className="mt-2 text-xs text-subtle leading-relaxed">
          Nothing here yet -- add words or start a pack, and this page fills up with everything you&apos;re
          learning, strongest first.
        </p>
      </section>
    );
  }

  const wordButton = (f: FoldWord) => (
    <button
      key={f.word.id}
      onMouseEnter={() => setHovered(f)}
      onClick={() => onPrompt(`Quiz me on "${f.word.arabizi}"`)}
      aria-label={`Quiz me on ${f.word.arabizi}`}
      className={cn(
        // Padding (not flex gap) provides the spacing, so tap targets tile
        // with no dead space; scale (not weight) grows the word in place,
        // so lines never re-wrap on hover.
        "inline-block px-[4.5px] py-[2px] text-[13.5px] leading-6 rounded-sm origin-center relative",
        "transition-[filter,opacity,color,transform] duration-200",
        "hover:scale-[1.22] hover:opacity-100 hover:blur-0 hover:z-10 hover:text-green-700",
        "active:scale-[1.1]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
        KIND_STYLE[f.kind]
      )}
    >
      {f.word.arabizi}
    </button>
  );

  return (
    <section
      className="rounded-xl bg-white border border-gray-200 shadow-sm"
      onMouseLeave={() => setHovered(null)}
    >
      <div className="px-4 pt-3 flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">
          Your words, strongest first
        </span>
        <span className="text-[10px] font-mono text-disabled tabular-nums">
          {fold.length} of {startedTotal}
        </span>
      </div>
      <div className="px-[11px] pt-2 pb-1 select-none">
        <div className="flex flex-wrap items-baseline">
          {(foldAt === -1 ? fold : fold.slice(0, foldAt)).map(wordButton)}
          {foldAt !== -1 && (
            <>
              <div className="w-full flex items-center gap-2 my-1.5" aria-hidden="true">
                <span className="flex-1 border-t border-dashed border-amber-300" />
                <span className="font-mono text-[9px] tracking-[0.1em] text-amber-600">
                  THE FOLD · {data.counts.dueNow} ASLEEP BELOW
                </span>
                <span className="flex-1 border-t border-dashed border-amber-300" />
              </div>
              {fold.slice(foldAt).map(wordButton)}
            </>
          )}
        </div>
      </div>
      <div className="h-[48px] mx-3 mb-2.5 mt-1">
        {hovered ? (
          <div className="h-full flex items-center rounded-lg bg-gray-50 px-3 leading-tight">
            <div className="min-w-0">
              <div className="truncate">
                <span className="text-sm font-semibold text-heading">{hovered.word.arabizi}</span>
                <span className="ml-2 text-xs text-subtle">{hovered.word.english}</span>
              </div>
              <div className="font-mono text-[10px] text-disabled mt-0.5">{KIND_LABEL[hovered.kind]}</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center gap-3 px-1.5 text-[10px] font-mono text-subtle">
            <span>
              fading in memory order -- reviews lift words{" "}
              <span className="text-heading font-semibold">back above the fold</span>
            </span>
            <span className="ml-auto text-disabled shrink-0">tap to quiz</span>
          </div>
        )}
      </div>
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
    <section className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-3.5 shrink-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">
        {isBacklog ? "Recovery plan" : "Next up"}
      </div>
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
            className="mt-1.5 w-full h-10 rounded-lg text-[13px] font-medium text-subtle hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
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
    <section className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-3 grid grid-cols-3 shrink-0">
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
export function ProgressPanel({
  data,
  onPrompt,
}: {
  data: ProgressData | null;
  onPrompt?: (text: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  // Live tick: drives the countdown and lets the fold's ordering and
  // retention estimates decay in real time while the panel is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data) {
    // Structural skeleton mirroring the three panel sections, so the drawer
    // opens onto the panel's shape instead of a bare loading string.
    return (
      <div className="flex flex-col h-full p-3 gap-2.5" aria-busy="true" aria-label="Loading progress">
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-12" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 space-y-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }

  const send = onPrompt ?? (() => {});

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-2.5">
      <FoldCard data={data} now={now} onPrompt={send} />
      <NextAction data={data} now={now} onPrompt={send} />
      <Stats data={data} now={now} />
    </div>
  );
}
