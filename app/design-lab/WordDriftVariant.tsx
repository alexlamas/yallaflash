"use client";

// Variant N — "Word drift"
// Drift's axis, but the words themselves are the marks: your vocabulary
// strewn across the memory axis, crisp on the right, dissolving as it
// drifts left past the due line. Position = the same e^(-t/S) the SRS
// schedules with; type replaces dots entirely.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, type LabWord, retention, sampleKinds, sampleVocab, seeded, type SampleKind } from "./fixtures";
import { Card, Eyebrow, MissionChassis } from "./chassis";

type Item = {
  key: string;
  arabizi: string;
  english: string;
  kind: SampleKind;
  /** 0..1 along the memory axis */
  t: number;
  real?: LabWord;
};

const KIND_STYLE: Record<SampleKind, string> = {
  strong: "text-gray-900 opacity-100",
  ok: "text-gray-700 opacity-85 blur-[0.3px]",
  fading: "text-amber-700/80 opacity-65 blur-[0.9px]",
  asleep: "text-gray-500 opacity-25 blur-[2px]",
};

const KIND_LABEL: Record<SampleKind, string> = {
  strong: "solid — far from the edge",
  ok: "settled",
  fading: "drifting — review soon",
  asleep: "past the due line",
};

const DUE_T = 0.3;

function axisT(word: LabWord): { t: number; kind: SampleKind } {
  if (word.dueInDays < -0.5) {
    // deeper overdue drifts further left
    const t = Math.max(0.02, DUE_T - 0.04 - Math.min(-word.dueInDays, 15) * 0.016);
    return { t, kind: "asleep" };
  }
  const r = retention(word) ?? 0.5;
  return { t: DUE_T + 0.06 + r * (0.94 - DUE_T - 0.06), kind: r > 0.75 ? "strong" : r > 0.45 ? "ok" : "fading" };
}

const MAX_GHOSTS = 8;

function buildItems(data: Scenario): { items: Item[]; hiddenAsleep: number } {
  // Real fixture words carry the interaction; synthetic ones fill the field.
  const real: Item[] = data.words
    .filter((w) => w.reviewCount > 0 || w.dueInDays < -0.5)
    .map((w) => {
      const { t, kind } = axisT(w);
      return { key: w.id, arabizi: w.arabizi, english: w.english, kind, t, real: w };
    });
  // Pad only the awake side — more ghosts would just pile onto the column.
  const padKinds = sampleKinds(data, 10, "wd").filter((k) => k !== "asleep");
  const padVocab = sampleVocab(padKinds.length, `${data.key}wdv`);
  const pad: Item[] = padKinds.map((kind, i) => {
    const h = seeded(`${data.key}wdt${i}`);
    const u = (h % 1000) / 1000;
    const t = DUE_T + 0.08 + u * (0.94 - DUE_T - 0.08);
    const [arabizi, english] = padVocab[i];
    return { key: `p${i}`, arabizi, english, kind, t };
  });
  // Show only the most recently slipped ghosts; the rest become a count.
  const all = [...real, ...pad];
  const ghosts = all.filter((it) => it.kind === "asleep").sort((a, b) => b.t - a.t);
  const shownGhosts = new Set(ghosts.slice(0, MAX_GHOSTS).map((g) => g.key));
  const items = all.filter((it) => it.kind !== "asleep" || shownGhosts.has(it.key));
  return { items, hiddenAsleep: Math.max(0, data.dueNow - Math.min(ghosts.length, MAX_GHOSTS)) };
}

/** Greedy lane packing so words never overlap: sort by x, first free lane. */
function layout(items: Item[], width: number): (Item & { x: number; lane: number })[] {
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const laneEnds: number[] = [];
  return sorted.map((it) => {
    const w = it.arabizi.length * 7.2 + 6;
    let x = 8 + it.t * (width - 16) - w / 2;
    x = Math.max(4, Math.min(width - w - 4, x));
    let lane = laneEnds.findIndex((end) => end <= x);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = x + w;
    return { ...it, x, lane };
  });
}

export function WordDriftVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [pin, setPin] = useState<Item | null>(null);
  const [hover, setHover] = useState<Item | null>(null);
  const sel = pin ?? hover;

  const WIDTH = 340;
  const { items, hiddenAsleep } = buildItems(data);
  const placed = layout(items, WIDTH);
  const lanes = Math.max(...placed.map((p) => p.lane)) + 1;
  const LANE_H = 24;
  const height = lanes * LANE_H + 12;
  const asleepCount = data.dueNow;

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right="left = fading away">Word drift</Eyebrow>
      </div>
      <div className="relative mx-2 mt-2 select-none" style={{ height }}>
        {/* due line */}
        <div
          className="absolute top-0 bottom-0 border-l border-dashed"
          style={{ left: 8 + DUE_T * (WIDTH - 16), borderColor: asleepCount > 0 ? "#fca5a5" : "#e5e7eb" }}
          aria-hidden="true"
        />
        {hiddenAsleep > 0 && (
          <button
            onClick={() => onAction(`Start a rescue session with my 10 weakest words`)}
            style={{ left: 8, bottom: 2 }}
            className="absolute font-mono text-[9.5px] text-amber-600/80 border border-dashed border-amber-300 rounded px-1.5 py-0.5 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
          >
            +{hiddenAsleep} more asleep
          </button>
        )}
        {placed.map((it) => {
          const selected = sel?.key === it.key;
          const dimmed = sel !== null && !selected;
          return (
            <button
              key={it.key}
              onMouseEnter={() => setHover(it)}
              onClick={() => setPin(pin?.key === it.key ? null : it)}
              aria-label={`${it.arabizi} — ${KIND_LABEL[it.kind]}`}
              style={{ left: it.x, top: 6 + it.lane * LANE_H }}
              className={cn(
                "absolute text-[13px] font-medium leading-5 px-0.5 rounded-sm whitespace-nowrap",
                "transition-[filter,opacity,color] duration-300",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
                selected ? "text-green-700 opacity-100 blur-0 z-10" : KIND_STYLE[it.kind],
                dimmed && "opacity-15"
              )}
            >
              {it.arabizi}
            </button>
          );
        })}
      </div>
      {/* axis labels */}
      <div className="relative mx-2 h-5 text-[9px] font-mono" aria-hidden="true">
        <span className={cn("absolute", asleepCount > 20 ? "text-amber-600 font-semibold" : "text-disabled")} style={{ left: 12 }}>
          asleep {asleepCount}
        </span>
        <span className="absolute text-disabled" style={{ left: 8 + DUE_T * (WIDTH - 16) - 14 }}>
          due
        </span>
        <span className="absolute right-3 text-disabled">solid</span>
      </div>
      <div className="h-[52px] mx-3 mb-2.5 mt-0.5">
        {sel ? (
          <div className="h-full flex items-center gap-3 rounded-lg bg-gray-50 px-3">
            <div className="flex-1 min-w-0 leading-tight">
              <div className="truncate">
                <span className="text-sm font-semibold text-heading">{sel.arabizi}</span>
                <span className="ml-2 text-xs text-subtle">{sel.english}</span>
              </div>
              <div className="font-mono text-[10px] text-disabled mt-0.5">{KIND_LABEL[sel.kind]}</div>
            </div>
            <button
              onClick={() => onAction(`Quiz me on "${sel.arabizi}"`)}
              className="shrink-0 h-9 px-3.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 active:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
            >
              Quiz me
            </button>
          </div>
        ) : (
          <div className="h-full flex items-center gap-3.5 px-1.5 text-[10px] font-mono text-subtle">
            <span>
              reviews pull words <span className="text-heading font-semibold">→ right</span>; time drags them
              toward the <span className={cn("font-semibold", asleepCount > 20 ? "text-amber-600" : "text-heading")}>due line</span>
            </span>
            <span className="ml-auto text-disabled shrink-0">hover or tap</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
