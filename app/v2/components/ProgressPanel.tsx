"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CedarForest } from "./CedarForest";
import type { ProgressState } from "@/app/v2/lib/types";

interface ProgressWord {
  id: string;
  arabizi: string;
  english: string;
  status: ProgressState;
  next_review_date: string;
}

interface ProgressData {
  counts: { new: number; learning: number; learned: number; dueNow: number };
  words: ProgressWord[];
}

const STATUS_DOT: Record<ProgressState, string> = {
  new: "bg-gray-300",
  learning: "bg-amber-400",
  learned: "bg-green-500",
};

export function ProgressPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v2/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!cancelled && result) setData(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!data) {
    return <div className="p-4 text-sm text-subtle">Loading progress...</div>;
  }

  const total = data.counts.new + data.counts.learning + data.counts.learned;
  // Learning counts as half-grown; only full cedars (learned) count fully.
  const percent = total === 0 ? 0 : Math.round(((data.counts.learned + 0.5 * data.counts.learning) / total) * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-heading">Your forest</span>
          <span className="text-sm font-semibold text-heading">{percent}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <CedarForest words={data.words} />

      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
        <span className="font-medium text-heading">{data.counts.dueNow} due now</span>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {total === 0 && (
          <div className="text-xs text-subtle">
            Nothing planted yet -- add words or start a pack in the chat, and your cedars will grow
            as you learn.
          </div>
        )}
        {data.words.map((word) => (
          <div key={word.id} className="flex items-center gap-2 text-sm">
            <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[word.status])} />
            <span className="font-medium text-heading truncate">{word.arabizi}</span>
            <span className="text-subtle truncate">{word.english}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
