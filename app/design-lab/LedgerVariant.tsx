"use client";

// Variant M — "Fading ledger"
// The page, given order: your words as a ledger sorted strongest → weakest,
// so the ink visibly runs out as you read down. It replaces the chassis'
// "slipping first" list entirely — the hero IS the list. Real data drives
// every row: retention % while it lasts, then "asleep Nd" as the ink goes.

import { cn } from "@/lib/utils";
import { type Scenario, type LabWord, retention, weakestFirst } from "./fixtures";
import { Card, Eyebrow, MissionChassis } from "./chassis";

const ROWS = 13;

function rowStyle(r: number | null): { text: string; blur: string } {
  if (r === null) return { text: "text-gray-400", blur: "blur-[2.2px] opacity-30" };
  if (r > 0.75) return { text: "text-gray-900", blur: "" };
  if (r > 0.45) return { text: "text-gray-800", blur: "blur-[0.3px] opacity-85" };
  if (r > 0.2) return { text: "text-gray-600", blur: "blur-[0.8px] opacity-60" };
  return { text: "text-gray-500", blur: "blur-[1.8px] opacity-35" };
}

function Row({ word, onAction }: { word: LabWord; onAction: (a: string) => void }) {
  const r = word.reviewCount === 0 ? null : retention(word);
  const overdue = word.dueInDays < -0.5;
  const style = rowStyle(overdue ? 0.05 : r);
  return (
    <button
      onClick={() => onAction(`Quiz me on "${word.arabizi}"`)}
      className="w-full flex items-baseline gap-3 h-[30px] px-1.5 text-left rounded-md group hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
    >
      <span
        className={cn(
          "text-[13.5px] font-medium truncate w-[92px] shrink-0 transition-[filter,opacity] duration-300 group-hover:blur-0 group-hover:opacity-100",
          style.text,
          style.blur
        )}
      >
        {word.arabizi}
      </span>
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-xs text-subtle transition-[filter,opacity] duration-300 group-hover:blur-0 group-hover:opacity-100",
          style.blur
        )}
      >
        {word.english}
      </span>
      {r === null && !overdue ? (
        <span className="font-mono text-[10px] text-disabled shrink-0">new</span>
      ) : overdue ? (
        <span className="font-mono text-[10.5px] text-amber-600 tabular-nums shrink-0">
          asleep {Math.round(-word.dueInDays)}d
        </span>
      ) : (
        <span
          className={cn(
            "font-mono text-[10.5px] tabular-nums shrink-0",
            r! > 0.75 ? "text-green-600" : r! > 0.45 ? "text-amber-500" : "text-red-500"
          )}
        >
          {Math.round(r! * 100)}%
        </span>
      )}
    </button>
  );
}

export function LedgerVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  // Strongest ink first; the fade takes over as you read down.
  const ordered = [...weakestFirst(data.words)].reverse().filter((w) => w.reviewCount > 0 || w.dueInDays < -0.5);
  const rows = ordered.slice(0, ROWS);
  const hiddenAsleep = Math.max(0, data.dueNow - rows.filter((w) => w.dueInDays < -0.5).length);
  const total = data.counts.new + data.counts.learning + data.counts.learned;

  const hero = (
    <Card>
      <div className="px-4 pt-3 pb-1.5 border-b border-gray-100">
        <Eyebrow right={`${total} words · hover to remember`}>The ledger</Eyebrow>
      </div>
      <div className="px-2.5 py-1.5">
        {rows.map((w) => (
          <Row key={w.id} word={w} onAction={onAction} />
        ))}
      </div>
      <button
        onClick={() => onAction("Show me all my words")}
        className="w-full h-10 text-[11px] font-mono text-subtle border-t border-gray-100 hover:bg-gray-50 active:bg-gray-100 rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
      >
        {hiddenAsleep > 0 ? (
          <>
            …and <span className="text-amber-600 font-semibold">{hiddenAsleep} more</span> faded below the fold
          </>
        ) : (
          <>see the whole ledger</>
        )}
      </button>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} hideWeakest />;
}
