"use client";

// Variant R — "Annotated fold"
// Pudding technique #2: hand-placed annotation. The fold page from P, but
// two words carry editorial callouts — a green one above your rock-solid
// word, an amber one below the freshest ghost — like a chart annotated by
// a person, not a legend.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, sampleKinds, sampleVocab, seeded, type SampleKind } from "./fixtures";
import { Card, Eyebrow, MissionChassis, DetailRow } from "./chassis";

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

const SHOWN = 40;

function buildItems(data: Scenario): Item[] {
  const kinds = sampleKinds(data, SHOWN, "anno");
  const vocab = sampleVocab(SHOWN, `${data.key}annov`);
  return kinds
    .map((kind, i) => ({ i, arabizi: vocab[i % vocab.length][0], english: vocab[i % vocab.length][1], kind }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || seeded(`${data.key}ao${a.i}`) - seeded(`${data.key}ao${b.i}`));
}

export function AnnotatedVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [pin, setPin] = useState<Item | null>(null);
  const [hover, setHover] = useState<Item | null>(null);
  const sel = pin ?? hover;
  const items = buildItems(data);
  const foldAt = items.findIndex((it) => it.kind === "asleep");
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  // Annotate mid-line words so the labels stay inside the card.
  const heroWordI = items[Math.min(2, items.length - 1)]?.i;
  const ghostWordI = foldAt !== -1 ? items[Math.min(foldAt + 2, items.length - 1)].i : undefined;

  const word = (it: Item) => {
    const selected = sel?.i === it.i;
    const annotation =
      it.i === heroWordI
        ? { text: "solid for 47 days", tone: "text-green-700 border-green-300", side: "top" as const }
        : it.i === ghostWordI
        ? { text: "slipped 1d ago ↑ start here", tone: "text-amber-600 border-amber-300", side: "bottom" as const }
        : null;
    const btn = (
      <button
        key={annotation ? undefined : it.i}
        onMouseEnter={() => setHover(it)}
        onClick={() => setPin(pin?.i === it.i ? null : it)}
        aria-label={`${it.arabizi} — ${KIND_LABEL[it.kind]}`}
        className={cn(
          "text-[13.5px] leading-6 rounded-sm transition-[filter,opacity,color] duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
          selected ? "font-semibold text-green-700 opacity-100 blur-0" : KIND_STYLE[it.kind]
        )}
      >
        {it.arabizi}
      </button>
    );
    if (!annotation) return btn;
    return (
      <span key={it.i} className="relative inline-flex">
        {annotation.side === "top" && (
          <span
            className={cn(
              "absolute -top-[15px] left-0 whitespace-nowrap font-mono text-[8.5px] leading-none border-b border-dashed pb-[2px]",
              annotation.tone
            )}
            aria-hidden="true"
          >
            {annotation.text}
          </span>
        )}
        {btn}
        {annotation.side === "bottom" && (
          <span
            className={cn(
              "absolute -bottom-[13px] left-0 whitespace-nowrap font-mono text-[8.5px] leading-none border-t border-dashed pt-[2px]",
              annotation.tone
            )}
            aria-hidden="true"
          >
            {annotation.text}
          </span>
        )}
      </span>
    );
  };

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${SHOWN} of ${total}`}>The page, annotated</Eyebrow>
      </div>
      <div className="px-4 pt-4 pb-1 select-none">
        <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[7px] leading-7">
          {(foldAt === -1 ? items : items.slice(0, foldAt)).map(word)}
          {foldAt !== -1 && (
            <>
              <div className="w-full flex items-center gap-2 my-2" aria-hidden="true">
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
      <DetailRow
        word={sel ? { arabizi: sel.arabizi, english: sel.english, note: KIND_LABEL[sel.kind] } : null}
        onAction={onAction}
        hint={
          <>
            <span>two callouts, placed like an editor would — the rest stays quiet</span>
            <span className="ml-auto text-disabled shrink-0">hover or tap</span>
          </>
        }
      />
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
