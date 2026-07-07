"use client";

// Variant F — "Memory field"
// Signature: the entire vocabulary as one dense, tappable dot-matrix.
// Fill = memory strength, hollow rings = asleep (overdue), small gray = not
// started. Dots settle in with a staggered entrance; selecting one dims the
// rest of the field to spotlight it. A backlog reads as a field gone quiet,
// not a wall of red.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, VOCAB_LOOKUP } from "./fixtures";
import { Card, Eyebrow, MissionChassis, hash } from "./chassis";

type Dot = {
  i: number;
  arabizi: string;
  english: string;
  kind: "strong" | "ok" | "fading" | "asleep" | "new";
};

const KIND_FILL: Record<Dot["kind"], string> = {
  strong: "#15803d",
  ok: "#4ade80",
  fading: "#f59e0b",
  asleep: "none",
  new: "#e5e7eb",
};

const KIND_LABEL: Record<Dot["kind"], string> = {
  strong: "solid — long time till review",
  ok: "settled",
  fading: "fading — review soon",
  asleep: "asleep — needs a review",
  new: "not started yet",
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function buildDots(data: Scenario): Dot[] {
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  // Build the kind pool, then scatter it with a coprime stride so asleep
  // dots weave through the field instead of forming a block.
  const kinds: Dot["kind"][] = [];
  for (let i = 0; i < data.dueNow; i++) kinds.push("asleep");
  for (let i = 0; i < data.counts.new; i++) kinds.push("new");
  while (kinds.length < total) {
    const s = hash(`${data.key}s${kinds.length}`) % 100;
    kinds.push(s > 55 ? "strong" : s > 20 ? "ok" : "fading");
  }
  let stride = 73;
  while (gcd(stride, total) !== 1) stride += 2;
  const dots: Dot[] = new Array(total);
  for (let i = 0; i < total; i++) {
    const pos = (i * stride + 11) % total;
    const [arabizi, english] = VOCAB_LOOKUP[pos % VOCAB_LOOKUP.length];
    dots[pos] = { i: pos, arabizi, english, kind: kinds[i] };
  }
  return dots;
}

export function FieldVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  // Hover previews (sticky, so the cursor can travel to the quiz button);
  // click/tap pins — the only path on touch, where the panel actually ships.
  const [pin, setPin] = useState<Dot | null>(null);
  const [hover, setHover] = useState<Dot | null>(null);
  const sel = pin ?? hover;
  const dots = buildDots(data);
  const cols = 20;
  const cell = 288 / cols;
  const rows = Math.ceil(dots.length / cols);
  const height = rows * cell + 8;
  const awake = dots.length - data.dueNow - data.counts.new;

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${dots.length} words`}>Memory field</Eyebrow>
      </div>
      <div className="px-3 pt-2.5">
        <svg
          viewBox={`0 0 288 ${height}`}
          className="w-full block"
          role="img"
          aria-label={`Memory field: ${awake} words awake, ${data.dueNow} asleep, ${data.counts.new} new`}
          onClick={(e) => {
            // tap empty space to release the spotlight
            if (e.target === e.currentTarget) {
              setPin(null);
              setHover(null);
            }
          }}
        >
          {dots.map((d, idx) => {
            // Hand-planted, not machine-stamped: each dot sits slightly off
            // its grid cell, with a whisper of size variation.
            const jx = ((hash(`${data.key}jx${d.i}`) % 100) / 100 - 0.5) * 4.6;
            const jy = ((hash(`${data.key}jy${d.i}`) % 100) / 100 - 0.5) * 4.6;
            const x = Math.round(((idx % cols) * cell + cell / 2 + jx) * 100) / 100;
            const y = Math.round((Math.floor(idx / cols) * cell + cell / 2 + 4 + jy) * 100) / 100;
            const size = 3.2 + ((hash(`${data.key}jr${d.i}`) % 100) / 100) * 0.7;
            const selected = sel?.i === d.i;
            const dimmed = sel !== null && !selected;
            return (
              <circle
                key={`${data.key}-${d.i}`}
                cx={x}
                cy={y}
                r={d.kind === "new" ? 2 : selected ? 5.2 : Math.round(size * 100) / 100}
                fill={KIND_FILL[d.kind]}
                stroke={d.kind === "asleep" ? (selected ? "#b45309" : "#d1d5db") : selected ? "#111827" : "none"}
                strokeWidth={d.kind === "asleep" ? 1.2 : selected ? 1.6 : 0}
                className="cursor-pointer lab-settle"
                style={{
                  opacity: dimmed ? 0.22 : undefined,
                  transition: "opacity 200ms ease, r 150ms ease",
                  animationDelay: `${(hash(`${data.key}in${d.i}`) % 24) * 28}ms`,
                }}
                onMouseEnter={() => setHover(d)}
                onClick={() => setPin(pin?.i === d.i ? null : d)}
              />
            );
          })}
        </svg>
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
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
              awake <span className="tabular-nums">{awake}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full border border-gray-300 inline-block" />
              asleep <span className={cn("tabular-nums", data.dueNow > 20 && "text-amber-600 font-semibold")}>{data.dueNow}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-200 inline-block" />
              new <span className="tabular-nums">{data.counts.new}</span>
            </span>
            <span className="ml-auto text-disabled">hover or tap a dot</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
