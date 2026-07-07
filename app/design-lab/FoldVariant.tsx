"use client";

// Variant P — "The fold"
// The synthesis of the fading page (L) and word drift (N): one flowing page
// of words ordered strongest → weakest, so reading order IS the memory axis.
// Fading uses font weight first (a precise typographic channel — Brath,
// "Visualizing with Text"), opacity second, blur last and capped so ghosts
// stay clearly intentional. Where the asleep words begin, the page folds:
// a labeled rule — everything below it is waiting for you.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, sampleVocab, seeded, type SampleKind } from "./fixtures";
import { Card, Eyebrow, MissionChassis } from "./chassis";

type Item = { i: number; arabizi: string; english: string; kind: SampleKind };

const KIND_ORDER: Record<SampleKind, number> = { strong: 0, ok: 1, fading: 2, asleep: 3 };

const KIND_STYLE: Record<SampleKind, string> = {
  strong: "font-semibold text-gray-900",
  ok: "font-normal text-gray-800 opacity-90",
  fading: "font-light text-gray-600 opacity-70 blur-[0.4px]",
  asleep: "font-light text-gray-500 opacity-35 blur-[1.4px]",
};

const KIND_LABEL: Record<SampleKind, string> = {
  strong: "bold in your memory",
  ok: "settled",
  fading: "losing weight — review soon",
  asleep: "below the fold — review to lift it back",
};

const SHOWN = 48;

function buildItems(data: Scenario): Item[] {
  // Curated, not proportional: the words that need you get guaranteed slots.
  // With 1000 learned and 3 due, a proportional sample would show a wall of
  // solid words and bury the 3 that matter — instead, every due word (up to
  // a cap) makes the page, and the strong ones fill the rest as backdrop.
  const asleepSlots = Math.min(data.dueNow, 16);
  const rest = SHOWN - asleepSlots;
  const kinds: SampleKind[] = [];
  for (let i = 0; i < asleepSlots; i++) kinds.push("asleep");
  for (let i = 0; i < rest; i++) {
    const s = seeded(`${data.key}foldk${i}`) % 100;
    kinds.push(s > 50 ? "strong" : s > 16 ? "ok" : "fading");
  }
  const vocab = sampleVocab(SHOWN, `${data.key}foldv`);
  const items = kinds.map((kind, i) => {
    const [arabizi, english] = vocab[i % vocab.length];
    return { i, arabizi, english, kind };
  });
  // Reading order is the axis: strongest ink first, ghosts last.
  return items.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || seeded(`${data.key}o${a.i}`) - seeded(`${data.key}o${b.i}`)
  );
}

export function FoldVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  // Hover previews; click sends the quiz prompt to the tutor immediately.
  const [hover, setHover] = useState<Item | null>(null);
  const sel = hover;
  const items = buildItems(data);
  const foldAt = items.findIndex((it) => it.kind === "asleep");
  const total = data.counts.new + data.counts.learning + data.counts.learned;

  const word = (it: Item) => {
    return (
      <button
        key={it.i}
        onMouseEnter={() => setHover(it)}
        onClick={() => onAction(`Quiz me on "${it.arabizi}"`)}
        aria-label={`Quiz me on ${it.arabizi} — ${KIND_LABEL[it.kind]}`}
        className={cn(
          // Padding (not flex gap) provides the spacing, so hover targets
          // tile with no dead space; scale (not weight) grows the word in
          // place, so lines never re-wrap.
          "inline-block px-[4.5px] py-[2px] text-[13.5px] leading-6 rounded-sm origin-center relative",
          "transition-[filter,opacity,color,transform] duration-200",
          "hover:scale-[1.22] hover:opacity-100 hover:blur-0 hover:z-10 hover:text-green-700",
          "active:scale-[1.1]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
          KIND_STYLE[it.kind]
        )}
      >
        {it.arabizi}
      </button>
    );
  };

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${SHOWN} of ${total}`}>Your words, strongest first</Eyebrow>
      </div>
      <div className="px-[11px] pt-2.5 pb-1 select-none">
        <div className="flex flex-wrap items-baseline">
          {(foldAt === -1 ? items : items.slice(0, foldAt)).map(word)}
          {foldAt !== -1 && (
            <>
              {/* the fold: reading past this line means words need you */}
              <div className="w-full flex items-center gap-2 my-1.5" aria-hidden="true">
                <span className="flex-1 border-t border-dashed border-amber-300" />
                <span className="font-mono text-[9px] tracking-[0.1em] text-amber-600">
                  THE FOLD · {data.dueNow} ASLEEP BELOW
                </span>
                <span className="flex-1 border-t border-dashed border-amber-300" />
              </div>
              {items.slice(foldAt).map(word)}
            </>
          )}
        </div>
      </div>
      <div className="h-[52px] mx-3 mb-2.5 mt-1.5">
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
              fading in memory order — reviews lift words{" "}
              <span className="text-heading font-semibold">back above the fold</span>
            </span>
            <span className="ml-auto text-disabled shrink-0">hover to peek · click to quiz</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
