"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="text-sm font-medium text-heading">Progress</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-heading">{data.counts.dueNow}</span>
          <span className="text-xs text-subtle">due now</span>
        </div>
        <div className="mt-3 space-y-1 text-xs text-subtle">
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT.new)} />
            {data.counts.new} new
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT.learning)} />
            {data.counts.learning} learning
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT.learned)} />
            {data.counts.learned} learned
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {total === 0 && (
          <div className="text-xs text-subtle">
            No words yet -- add some or start a pack in the chat.
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
