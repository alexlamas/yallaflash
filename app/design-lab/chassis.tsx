"use client";

// Shared "mission control" chassis. Every variant keeps this structure —
// hero visual, one next action sized in minutes, human stats, five weakest
// words — and swaps only the hero. So the comparison is purely about the
// visual layer.

import { cn } from "@/lib/utils";
import { type Scenario, type LabWord, retention, weakestFirst, minutesFor } from "./fixtures";

export function Card({
  className,
  children,
  onMouseLeave,
}: {
  className?: string;
  children: React.ReactNode;
  onMouseLeave?: () => void;
}) {
  return (
    <section
      className={cn("rounded-xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.05)]", className)}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-subtle">{children}</span>
      {right && <span className="text-[10px] font-mono text-disabled">{right}</span>}
    </div>
  );
}

function NextAction({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const isBacklog = data.dueNow > 20;
  const bite = Math.min(10, Math.max(1, data.dueNow));
  const daysToClear = Math.max(1, Math.ceil(data.dueNow / 25));

  return (
    <Card className="px-4 py-3.5">
      <Eyebrow>{isBacklog ? "Recovery plan" : "Next up"}</Eyebrow>
      {isBacklog ? (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-body">
            <span className="font-semibold text-heading tabular-nums">{data.dueNow} words</span> went quiet
            while you were away. 25 a day wakes them all in{" "}
            <span className="font-semibold text-heading tabular-nums">{daysToClear} days</span>.
          </p>
          <button
            onClick={() => onAction(`Start a rescue session with my ${bite} weakest words`)}
            className="mt-3 w-full h-11 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 transition-colors"
          >
            Wake the {bite} weakest · {minutesFor(bite)} min
          </button>
          <button
            onClick={() => onAction("Start a full review session")}
            className="mt-2 w-full h-10 rounded-lg text-[13px] font-medium text-subtle hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
          >
            I have time — full session ({minutesFor(25)} min)
          </button>
        </>
      ) : data.dueNow > 0 ? (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-body">
            <span className="font-semibold text-heading tabular-nums">{data.dueNow} words due</span> — quick
            one before they fade.
          </p>
          <button
            onClick={() => onAction(`Review my ${data.dueNow} due words`)}
            className="mt-3 w-full h-11 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 transition-colors"
          >
            Clear them · {minutesFor(data.dueNow)} min
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-snug text-body">All caught up. Get ahead of tomorrow:</p>
          <button
            onClick={() => onAction("Teach me 3 new words")}
            className="mt-3 w-full h-11 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 transition-colors"
          >
            Learn 3 new words · 2 min
          </button>
        </>
      )}
    </Card>
  );
}

function Stats({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const max = Math.max(...data.reviewsByDay, 1);
  return (
    <Card className="px-4 py-3 grid grid-cols-3">
      <button
        onClick={() => onAction("Tell me about my streak")}
        className="text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
      >
        <div className={cn("font-mono text-[17px] tabular-nums leading-6", data.streak > 0 ? "text-heading" : "text-disabled")}>
          {data.streak}
          {data.streak > 0 && <span className="text-[13px]"> 🔥</span>}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-1">Streak</div>
      </button>
      <button
        onClick={() => onAction("How am I doing on today's goal?")}
        className="text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
      >
        <div className="font-mono text-[17px] tabular-nums leading-6 text-heading">
          {data.reviewedToday}
          <span className="text-disabled text-[13px]">/{data.dailyGoal}</span>
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-1">Today</div>
      </button>
      <button
        onClick={() => onAction("Show my progress this week")}
        className="text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        aria-label={`Reviews this week: ${data.reviewsByDay.join(", ")}`}
      >
        <div className="flex items-end gap-[3px] h-6" aria-hidden="true">
          {data.reviewsByDay.map((n, i) => (
            <span
              key={i}
              style={{ height: Math.max(3, Math.round((n / max) * 22)) }}
              className={cn("w-[6px] rounded-[1.5px]", n === 0 ? "bg-gray-200" : "bg-green-500")}
            />
          ))}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-disabled mt-1">Week</div>
      </button>
    </Card>
  );
}

function Weakest({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const rows = weakestFirst(data.words).slice(0, 5);
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  return (
    <Card>
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <Eyebrow right="tap to quiz">Slipping first</Eyebrow>
      </div>
      <div className="px-2.5 py-1">
        {rows.map((w) => (
          <Row key={w.id} word={w} onAction={onAction} />
        ))}
      </div>
      <button
        onClick={() => onAction("Show me all my words")}
        className="w-full h-10 text-xs font-medium text-subtle border-t border-gray-100 hover:bg-gray-50 active:bg-gray-100 rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
      >
        See all {total} words
      </button>
    </Card>
  );
}

function Row({ word, onAction }: { word: LabWord; onAction: (a: string) => void }) {
  const r = retention(word);
  const overdue = word.dueInDays < -0.5;
  return (
    <button
      onClick={() => onAction(`Quiz me on "${word.arabizi}"`)}
      className="w-full flex items-baseline gap-3 h-11 px-1.5 text-left rounded-md hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
    >
      <span className="text-sm font-medium text-heading truncate w-[84px] shrink-0">{word.arabizi}</span>
      <span className="flex-1 min-w-0 truncate text-xs text-subtle">{word.english}</span>
      {r === null ? (
        <span className="font-mono text-[10px] text-disabled">new</span>
      ) : overdue ? (
        <span className="font-mono text-[11px] text-amber-600 tabular-nums shrink-0">
          asleep {Math.round(-word.dueInDays)}d
        </span>
      ) : (
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums shrink-0",
            r > 0.75 ? "text-green-600" : r > 0.45 ? "text-amber-500" : "text-red-500"
          )}
        >
          {Math.round(r * 100)}%
        </span>
      )}
    </button>
  );
}

export function MissionChassis({
  data,
  onAction,
  hero,
  hideWeakest,
}: {
  data: Scenario;
  onAction: (a: string) => void;
  hero: React.ReactNode;
  /** for heroes that already ARE the word list (e.g. the ledger) */
  hideWeakest?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 p-3 bg-gray-50 min-h-full">
      {hero}
      <NextAction data={data} onAction={onAction} />
      <Stats data={data} onAction={onAction} />
      {!hideWeakest && <Weakest data={data} onAction={onAction} />}
    </div>
  );
}

export function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

export interface SpotWord {
  arabizi: string;
  english: string;
  note: string;
}

/** Fixed-height footer row: legend/hint by default, word card when selected. */
export function DetailRow({
  word,
  hint,
  onAction,
}: {
  word: SpotWord | null;
  hint: React.ReactNode;
  onAction: (a: string) => void;
}) {
  return (
    <div className="h-[52px] mx-3 mb-2.5 mt-1.5">
      {word ? (
        <div className="h-full flex items-center gap-3 rounded-lg bg-gray-50 px-3">
          <div className="flex-1 min-w-0 leading-tight">
            <div className="truncate">
              <span className="text-sm font-semibold text-heading">{word.arabizi}</span>
              <span className="ml-2 text-xs text-subtle">{word.english}</span>
            </div>
            <div className="font-mono text-[10px] text-disabled mt-0.5">{word.note}</div>
          </div>
          <button
            onClick={() => onAction(`Quiz me on "${word.arabizi}"`)}
            className="shrink-0 h-9 px-3.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
          >
            Quiz me
          </button>
        </div>
      ) : (
        <div className="h-full flex items-center gap-3.5 px-1.5 text-[10px] font-mono text-subtle">{hint}</div>
      )}
    </div>
  );
}
