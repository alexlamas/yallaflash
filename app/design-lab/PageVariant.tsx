"use client";

// Variant L — "Fading page"
// The most literal answer to "can I see my memory fading?": the actual
// words, written on a page, fading and blurring exactly as your recall
// does (opacity/blur ∝ e^(-t/S)). A ghost word is one you can no longer
// read — because you can no longer recall it. Hovering a ghost sharpens
// it back into focus: remembering, made visible.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, sampleVocab } from "./fixtures";
import { Card, Eyebrow, MissionChassis, hash } from "./chassis";

type Kind = "strong" | "ok" | "fading" | "asleep";
type Word = { i: number; arabizi: string; english: string; kind: Kind };

const KIND_STYLE: Record<Kind, string> = {
  strong: "text-gray-900 opacity-100",
  ok: "text-gray-800 opacity-80 blur-[0.4px]",
  fading: "text-gray-600 opacity-55 blur-[1px]",
  asleep: "text-gray-500 opacity-25 blur-[2.4px]",
};

const KIND_LABEL: Record<Kind, string> = {
  strong: "crisp — you know this one",
  ok: "settled",
  fading: "fading — the ink is going",
  asleep: "almost gone — review to re-ink it",
};

function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

const SHOWN = 51;

function buildWords(data: Scenario): Word[] {
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const started = total - data.counts.new;
  const asleepShare = data.dueNow / Math.max(started, 1);
  const vocab = sampleVocab(SHOWN, `${data.key}pgv`);
  const words: Word[] = [];
  for (let i = 0; i < SHOWN; i++) {
    const h = mix(hash(`${data.key}pg${i}`));
    const p = (h % 1000) / 1000;
    let kind: Kind;
    if (p < asleepShare) kind = "asleep";
    else {
      const s = (h >>> 10) % 100;
      kind = s > 55 ? "strong" : s > 18 ? "ok" : "fading";
    }
    const [arabizi, english] = vocab[i % vocab.length];
    words.push({ i, arabizi, english, kind });
  }
  return words;
}

export function PageVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [pin, setPin] = useState<Word | null>(null);
  const [hover, setHover] = useState<Word | null>(null);
  const sel = pin ?? hover;
  const words = buildWords(data);
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const ghosts = words.filter((w) => w.kind === "asleep").length;

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${SHOWN} of ${total}`}>The page</Eyebrow>
      </div>
      <div
        className="px-4 pt-2.5 pb-1 select-none"
        aria-label={`Your vocabulary page: ${ghosts} of ${SHOWN} words have faded toward illegibility`}
      >
        <div className="flex flex-wrap items-baseline gap-x-[9px] gap-y-[3px]">
          {words.map((w) => {
            const selected = sel?.i === w.i;
            return (
              <button
                key={w.i}
                onMouseEnter={() => setHover(w)}
                onClick={() => setPin(pin?.i === w.i ? null : w)}
                aria-label={`${w.arabizi} — ${KIND_LABEL[w.kind]}`}
                className={cn(
                  "font-medium text-[13.5px] leading-6 rounded-sm transition-[filter,opacity,color] duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
                  selected ? "text-green-700 opacity-100 blur-0" : KIND_STYLE[w.kind]
                )}
              >
                {w.arabizi}
              </button>
            );
          })}
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
              the ink fades as you forget —{" "}
              <span className={cn("font-semibold", ghosts > SHOWN / 3 ? "text-amber-600" : "text-heading")}>
                {ghosts} ghosts
              </span>{" "}
              on this page
            </span>
            <span className="ml-auto text-disabled shrink-0">hover to remember</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
