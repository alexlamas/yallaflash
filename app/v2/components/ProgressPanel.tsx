"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CedarForest } from "./CedarForest";
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

const STATUS_DOT: Record<ProgressState, string> = {
  new: "bg-gray-300",
  learning: "bg-amber-400",
  learned: "bg-green-500",
};

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

function SignalBars({ retention }: { retention: number }) {
  const lit = Math.max(1, Math.round(retention * 5));
  const tone = retention > 0.75 ? "bg-green-500" : retention > 0.45 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-end gap-[2.5px] h-4" aria-hidden="true">
      {[4, 7, 10, 13, 16].map((height, i) => (
        <span
          key={i}
          style={{ height }}
          className={cn("w-[5px] rounded-[1.5px]", i < lit ? tone : "bg-gray-200")}
        />
      ))}
    </div>
  );
}

// Blurred until the learner opts in: click/tap durably toggles the reveal,
// while hover and keyboard focus still give a temporary desktop preview.
function BlurredTranslation({ english }: { english: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={revealed}
      onClick={() => setRevealed((r) => !r)}
      className={cn(
        "flex-1 min-w-0 truncate text-left text-xs text-subtle rounded transition-[filter]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60",
        !revealed && "blur-[3px] hover:blur-none focus-visible:blur-none select-none"
      )}
    >
      {english}
    </button>
  );
}

// Data is fetched once by the chat shell and shared between the desktop
// sidebar and the mobile sheet, so the sheet never opens onto a spinner.
export function ProgressPanel({ data }: { data: ProgressData | null }) {
  const [now, setNow] = useState(() => Date.now());

  // Live tick: drives the countdown and lets retention estimates decay in
  // real time while the panel is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data) {
    // Structural skeleton mirroring the three panel sections, so the sheet
    // opens onto the panel's shape instead of a bare loading string.
    return (
      <div className="flex flex-col h-full p-3 gap-3" aria-busy="true" aria-label="Loading progress">
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const percent =
    total === 0 ? 0 : Math.round(((data.counts.learned + 0.5 * data.counts.learning) / total) * 100);

  const reviewed = data.words.filter((w) => w.review_count > 0);
  const retentions = reviewed
    .map((w) => retentionNow(w, now))
    .filter((r): r is number => r !== null);
  const meanRetention =
    retentions.length > 0 ? retentions.reduce((a, b) => a + b, 0) / retentions.length : null;
  const meanEase =
    reviewed.length > 0 ? reviewed.reduce((a, w) => a + w.ease_factor, 0) / reviewed.length : null;
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const reviewedToday = reviewed.filter((w) => new Date(w.updated_at).getTime() >= todayStart).length;

  const dueCount = data.words.filter((w) => new Date(w.next_review_date).getTime() <= now).length;
  const upcoming = data.words
    .map((w) => new Date(w.next_review_date).getTime() - now)
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)[0];

  // Weakest signal first; unreviewed words wait at the bottom.
  const telemetry = [...data.words].sort((a, b) => {
    const ra = retentionNow(a, now);
    const rb = retentionNow(b, now);
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      {/* Forest */}
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden shrink-0">
        <div className="px-4 pt-3 pb-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-heading">Your forest</span>
            <span className="text-sm font-semibold text-heading font-mono">{percent}%</span>
          </div>
          <div
            className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden"
            role="progressbar"
            aria-label="Learning progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-green-500 rounded-full transition-[width] duration-700"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <CedarForest words={data.words} />
        <div className="px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle border-t border-gray-100">
          <span className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT.new)} />
            {data.counts.new} new
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT.learning)} />
            {data.counts.learning} learning
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT.learned)} />
            {data.counts.learned} learned
          </span>
        </div>
      </section>

      {/* T-minus */}
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm px-4 py-3 shrink-0">
        <div className="text-[10px] font-mono tracking-[0.14em] text-subtle">NEXT REVIEW WINDOW</div>
        <div
          className={cn(
            "mt-1 font-mono text-2xl tabular-nums",
            dueCount > 0 ? "text-red-500" : "text-heading"
          )}
        >
          {dueCount > 0
            ? `${dueCount} DUE NOW`
            : upcoming !== undefined
            ? formatCountdown(upcoming)
            : "—"}
        </div>
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-between">
          <div>
            <div className="font-mono text-sm text-green-700">
              {meanRetention === null ? "—" : `${(meanRetention * 100).toFixed(1)}%`}
            </div>
            <div className="font-mono text-[9px] tracking-[0.12em] text-subtle mt-0.5">RETENTION</div>
          </div>
          <div>
            <div className="font-mono text-sm text-green-700">
              {meanEase === null ? "—" : meanEase.toFixed(2)}
            </div>
            <div className="font-mono text-[9px] tracking-[0.12em] text-subtle mt-0.5">MEAN EASE</div>
          </div>
          <div>
            <div className="font-mono text-sm text-green-700">{reviewedToday}</div>
            <div className="font-mono text-[9px] tracking-[0.12em] text-subtle mt-0.5">TODAY</div>
          </div>
        </div>
      </section>

      {/* Telemetry */}
      <section className="rounded-xl bg-white border border-gray-200 shadow-sm flex flex-col min-h-[10rem] shrink-0">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
          <span className="text-[10px] font-mono tracking-[0.14em] text-subtle">MEMORY TELEMETRY</span>
          <span className="text-[10px] font-mono text-subtle">e^(−t/S)</span>
        </div>
        <div className="px-4 py-2">
          {total === 0 && (
            <div className="text-xs text-subtle py-2">
              Nothing planted yet -- add words or start a pack, and your signals will appear here.
            </div>
          )}
          {telemetry.map((word) => {
            const retention = retentionNow(word, now);
            return (
              <div key={word.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                <span className="font-medium text-heading truncate w-[72px] shrink-0">{word.arabizi}</span>
                {retention === null ? (
                  <>
                    <BlurredTranslation english={word.english} />
                    <span className="font-mono text-[10px] text-subtle border border-gray-200 rounded px-1.5 py-0.5">
                      NEW
                    </span>
                  </>
                ) : (
                  <>
                    <BlurredTranslation english={word.english} />
                    <SignalBars retention={retention} />
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums w-9 text-right",
                        retention > 0.75
                          ? "text-green-600"
                          : retention > 0.45
                          ? "text-amber-500"
                          : "text-red-500"
                      )}
                    >
                      {Math.round(retention * 100)}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
