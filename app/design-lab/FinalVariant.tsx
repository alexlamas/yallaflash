"use client";

// Variant V — the synthesis (P + Q + T)
// P's folded page is the body: your words in memory order, weight-first
// fade, an amber fold where the asleep ones begin. Q's voice tells it:
// every beat is a sentence where the data lives in the prose. T's beats
// structure it: three readings of the same page — what you built, what
// the forgetting curve took, and the sweet-spot catch that brings it back.
// Tone: Nicky Case's memory explainer — science, warmly delivered.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, sampleKinds, sampleVocab, seeded, minutesFor, type SampleKind } from "./fixtures";
import { Card, Eyebrow, MissionChassis, DetailRow, type SpotWord } from "./chassis";

type Item = { i: number; arabizi: string; english: string; kind: SampleKind };

const KIND_ORDER: Record<SampleKind, number> = { strong: 0, ok: 1, fading: 2, asleep: 3 };

const BASE_STYLE: Record<SampleKind, string> = {
  strong: "font-semibold text-gray-900",
  ok: "font-normal text-gray-800 opacity-90",
  fading: "font-light text-gray-600 opacity-70 blur-[0.4px]",
  asleep: "font-light text-gray-500 opacity-35 blur-[1.4px]",
};

const KIND_LABEL: Record<SampleKind, string> = {
  strong: "bold in your memory — the curve is flat here",
  ok: "settled",
  fading: "near the sweet spot — catch it soon",
  asleep: "crossed the curve — one review wakes it",
};

const SHOWN = 40;

function Num({ value, tone }: { value: number | string; tone?: "amber" | "green" }) {
  return (
    <span
      className={cn(
        "font-mono font-semibold tabular-nums px-1 py-0.5 rounded",
        tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "green" ? "bg-green-50 text-green-700" : "text-heading"
      )}
    >
      {value}
    </span>
  );
}

function buildItems(data: Scenario): Item[] {
  const kinds = sampleKinds(data, SHOWN, "final");
  const vocab = sampleVocab(SHOWN, `${data.key}finalv`);
  return kinds
    .map((kind, i) => ({ i, arabizi: vocab[i % vocab.length][0], english: vocab[i % vocab.length][1], kind }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || seeded(`${data.key}fo${a.i}`) - seeded(`${data.key}fo${b.i}`));
}

export function FinalVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [beat, setBeat] = useState(0);
  const [pin, setPin] = useState<Item | null>(null);
  const [hover, setHover] = useState<Item | null>(null);
  const sel = pin ?? hover;

  const isBacklog = data.dueNow > 20;
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const items = buildItems(data);
  const foldAt = items.findIndex((it) => it.kind === "asleep");
  const rescue = items.filter((it) => it.kind === "asleep").slice(0, 3);
  const bite = Math.min(10, Math.max(1, data.dueNow));

  const GhostInline = ({ it }: { it: Item }) => (
    <button
      onMouseEnter={() => setHover(it)}
      onClick={() => setPin(pin?.i === it.i ? null : it)}
      className={cn(
        "italic rounded-sm transition-[filter,opacity,color] duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        sel?.i === it.i ? "text-green-700 opacity-100 blur-0" : "text-gray-500 opacity-45 blur-[0.9px]"
      )}
    >
      {it.arabizi}
    </button>
  );

  // Three readings of the same page, in the explainer's voice.
  const beats = [
    {
      lede: `You've planted ${total} words in your head.`,
      prose: (
        <>
          This page is all of them, loudest first — <span className="font-semibold text-heading">bold</span>{" "}
          means the memory is solid. And here&apos;s the thing: every single one is quietly decaying right
          now. Not a you-problem. Brains just do that.
        </>
      ),
      style: (kind: SampleKind) => BASE_STYLE[kind],
    },
    {
      lede: isBacklog ? "Then the forgetting curve did its thing." : "The forgetting curve is losing, for once.",
      prose: isBacklog ? (
        <>
          While you were away, <Num value={data.dueNow} tone="amber" /> words slid past the point of easy
          recall. They&apos;re not gone — they&apos;re asleep below the fold. The blur you&apos;re seeing is
          your actual recall, rendered.
        </>
      ) : (
        <>
          Only <Num value={data.dueNow} tone="amber" /> words are anywhere near the edge. Everything else is
          holding — this is what being ahead of the curve looks like.
        </>
      ),
      style: (kind: SampleKind) =>
        kind === "asleep" ? "font-light text-gray-500 opacity-45 blur-[1.2px]" : "font-light text-gray-400 opacity-40",
    },
    {
      lede: "Catch a word at the sweet spot, and the fade slows.",
      prose: (
        <>
          Review a word right as it slips and its decay curve flattens — days become weeks become months.{" "}
          {rescue.length > 0 ? (
            <>
              Start with <GhostInline it={rescue[0]} />
              {rescue[1] && (
                <>
                  {", "}
                  <GhostInline it={rescue[1]} />
                </>
              )}
              {rescue[2] && (
                <>
                  {" and "}
                  <GhostInline it={rescue[2]} />
                </>
              )}
              {" — "}
              <Num value={`${minutesFor(bite)} min`} tone="green" /> buys them back.
            </>
          ) : (
            <>Nothing is slipping right now — plant something new instead.</>
          )}
        </>
      ),
      style: (kind: SampleKind, i: number) =>
        rescue.some((r) => r.i === i)
          ? "font-semibold text-green-700 opacity-100"
          : kind === "asleep"
          ? "font-light text-gray-400 opacity-25 blur-[1.4px]"
          : "font-light text-gray-400 opacity-35",
    },
  ];

  const word = (it: Item) => {
    const selected = sel?.i === it.i;
    return (
      <button
        key={it.i}
        onMouseEnter={() => setHover(it)}
        onClick={() => setPin(pin?.i === it.i ? null : it)}
        aria-label={`${it.arabizi} — ${KIND_LABEL[it.kind]}`}
        className={cn(
          "text-[13px] leading-6 rounded-sm transition-all duration-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
          selected ? "font-semibold text-green-700 opacity-100 blur-0" : beats[beat].style(it.kind, it.i)
        )}
      >
        {it.arabizi}
      </button>
    );
  };

  const foldEmphasis = beat === 1;

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${beat + 1} / 3`}>How your memory is doing</Eyebrow>
      </div>
      {/* the voice (Q): lede + data-in-prose */}
      <div className="px-4 pt-2.5 min-h-[104px]">
        <h3 className="font-title font-medium text-[18px] leading-snug text-heading">{beats[beat].lede}</h3>
        <p className="mt-1.5 text-[12.5px] leading-[1.7] text-body">{beats[beat].prose}</p>
      </div>
      {/* the body (P): the folded page, restyled per beat (T) */}
      <div className="px-4 pt-2.5 pb-1 select-none">
        <div className="flex flex-wrap items-baseline gap-x-[9px] gap-y-[2px]">
          {(foldAt === -1 ? items : items.slice(0, foldAt)).map(word)}
          {foldAt !== -1 && (
            <>
              <div className="w-full flex items-center gap-2 my-1.5 transition-opacity duration-500" aria-hidden="true">
                <span className={cn("flex-1 border-t border-dashed", foldEmphasis ? "border-amber-400" : "border-amber-300")} />
                <span className={cn("font-mono text-[9px] tracking-[0.1em]", foldEmphasis ? "text-amber-700 font-semibold" : "text-amber-600")}>
                  THE FOLD · {data.dueNow} ASLEEP BELOW
                </span>
                <span className={cn("flex-1 border-t border-dashed", foldEmphasis ? "border-amber-400" : "border-amber-300")} />
              </div>
              {items.slice(foldAt).map(word)}
            </>
          )}
        </div>
      </div>
      {/* the beats (T): pager + forward momentum */}
      <div className="px-4 pt-1.5 flex items-center gap-2">
        {[0, 1, 2].map((b) => (
          <button
            key={b}
            onClick={() => setBeat(b)}
            aria-label={`Part ${b + 1}`}
            aria-current={beat === b}
            style={{ height: 6 }}
            className={cn(
              "rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600",
              beat === b ? "w-8 bg-green-600" : "w-6 bg-gray-200 hover:bg-gray-300"
            )}
          />
        ))}
        <button
          onClick={() =>
            beat < 2
              ? setBeat(beat + 1)
              : onAction(
                  isBacklog ? `Start a rescue session with my ${bite} weakest words` : data.dueNow > 0 ? `Review my ${data.dueNow} due words` : "Teach me 3 new words"
                )
          }
          className="ml-auto h-8 px-3 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-50 active:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 transition-colors"
        >
          {beat < 2 ? "so?  →" : "yalla →"}
        </button>
      </div>
      <DetailRow
        word={sel ? ({ arabizi: sel.arabizi, english: sel.english, note: KIND_LABEL[sel.kind] } satisfies SpotWord) : null}
        onAction={onAction}
        hint={
          <>
            <span>same page, three readings — the blur is your real recall</span>
            <span className="ml-auto text-disabled shrink-0">hover or tap a word</span>
          </>
        }
      />
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
