"use client";

// Variant J — "Drift"
// The synthesis of F and G: orderly where it carries meaning (one axis:
// asleep → fading → settled → solid), organic where it should feel alive
// (words pile into natural drifts, beeswarm-packed, never overlapping).
// The backlog is a heap on the left you can literally watch shrink.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { type Scenario, VOCAB_LOOKUP } from "./fixtures";
import { Card, Eyebrow, MissionChassis, hash } from "./chassis";

type Kind = "asleep" | "fading" | "ok" | "strong" | "new";
type Dot = { i: number; arabizi: string; english: string; kind: Kind; x: number; y: number; r: number };

const KIND_FILL: Record<Kind, string> = {
  asleep: "none",
  fading: "#f59e0b",
  ok: "#4ade80",
  strong: "#15803d",
  new: "#e5e7eb",
};

const KIND_LABEL: Record<Kind, string> = {
  asleep: "asleep — needs a review",
  fading: "fading — review soon",
  ok: "settled",
  strong: "solid — long time till review",
  new: "not started yet",
};

// Axis geometry (viewBox units)
const X0 = 14;
const X1 = 274;
const GROUND = 136; // words pile up from here, like dunes
const PAD = 0.8;

// Zones along the memory axis, [start, end] as fractions of the axis.
const ZONES: Record<Exclude<Kind, "new">, [number, number]> = {
  asleep: [0.0, 0.28],
  fading: [0.31, 0.51],
  ok: [0.53, 0.74],
  strong: [0.76, 1.0],
};

// Dot radius by kind, plus a whisper of per-word variation.
function dotRadius(kind: Kind, jitter: number): number {
  const base = kind === "strong" ? 3.5 : kind === "ok" ? 3.1 : kind === "fading" ? 2.9 : 3.2;
  return base + jitter * 0.5;
}

function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function buildDots(data: Scenario): Dot[] {
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const kinds: Kind[] = [];
  for (let i = 0; i < data.dueNow; i++) kinds.push("asleep");
  for (let i = 0; i < data.counts.new; i++) kinds.push("new");
  while (kinds.length < total) {
    const s = mix(hash(`${data.key}k${kinds.length}`)) % 100;
    kinds.push(s > 55 ? "strong" : s > 18 ? "ok" : "fading");
  }

  // Continuous position within the zone. A golden-ratio sequence spreads
  // words evenly across their zone (random x leaves gaps → streaky towers);
  // a pinch of hash jitter keeps it from feeling mechanical.
  const perKind: Record<string, number> = {};
  const swarm = kinds
    .map((kind, i) => {
      if (kind === "new") return null;
      const k = (perKind[kind] = (perKind[kind] ?? 0) + 1);
      const jitter = ((mix(hash(`${data.key}x${i}`)) % 100) / 100 - 0.5) * 0.06;
      const t = Math.min(0.999, Math.max(0.001, ((k * 0.618034) % 1) + jitter));
      const [z0, z1] = ZONES[kind];
      return { i, kind, x: X0 + (z0 + t * (z1 - z0)) * (X1 - X0) };
    })
    .filter((d): d is { i: number; kind: Kind; x: number } => d !== null);

  // Gravity packing: each word falls at its x and rests on the ground or
  // nestles on whatever is already there — the vocabulary piles into dunes
  // instead of seating-plan rows.
  const placed: { x: number; y: number; r: number }[] = [];
  const packed: Dot[] = swarm.map((d) => {
    const jitter = (mix(hash(`${data.key}r${d.i}`)) % 100) / 100;
    const r = dotRadius(d.kind, jitter);
    let y = GROUND - r;
    for (const p of placed) {
      const dx = p.x - d.x;
      const gap = p.r + r + PAD;
      if (Math.abs(dx) < gap) {
        const rest = p.y - Math.sqrt(gap * gap - dx * dx);
        if (rest < y) y = rest;
      }
    }
    placed.push({ x: d.x, y, r });
    const [arabizi, english] = VOCAB_LOOKUP[d.i % VOCAB_LOOKUP.length];
    return { i: d.i, arabizi, english, kind: d.kind, x: r2(d.x), y: r2(y), r: r2(r) };
  });

  return packed;
}

export function DriftVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  // Hover previews (sticky, so the cursor can travel to the quiz button);
  // click/tap pins — the only path on touch, where the panel actually ships.
  const [pin, setPin] = useState<Dot | null>(null);
  const [hover, setHover] = useState<Dot | null>(null);
  const sel = pin ?? hover;
  const dots = buildDots(data);
  const total = data.counts.new + data.counts.learning + data.counts.learned;

  const zoneLabels: { key: Exclude<Kind, "new">; label: string; tone: string }[] = [
    { key: "asleep", label: `asleep ${data.dueNow}`, tone: data.dueNow > 20 ? "#b45309" : "#9ca3af" },
    { key: "fading", label: "fading", tone: "#9ca3af" },
    { key: "ok", label: "settled", tone: "#9ca3af" },
    { key: "strong", label: "solid", tone: "#9ca3af" },
  ];

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${total} words`}>Memory drift</Eyebrow>
      </div>
      <div className="px-1 pt-1">
        <svg
          viewBox="0 0 288 158"
          className="w-full block"
          role="img"
          aria-label={`Memory drift: ${data.dueNow} words asleep, drifting right as they strengthen`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPin(null);
              setHover(null);
            }
          }}
        >
          {/* the ground everything rests on */}
          <line x1={X0 - 4} x2={X1 + 4} y1={GROUND + 1.5} y2={GROUND + 1.5} stroke="#e5e7eb" strokeWidth={1} />
          {/* the due line: everything left of it needs you */}
          <line
            x1={X0 + 0.295 * (X1 - X0)}
            x2={X0 + 0.295 * (X1 - X0)}
            y1={34}
            y2={GROUND + 1.5}
            stroke={data.dueNow > 0 ? "#fca5a5" : "#e5e7eb"}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          {dots.map((d) => {
            const selected = sel?.i === d.i;
            const dimmed = sel !== null && !selected;
            return (
              <circle
                key={`${data.key}-${d.i}`}
                cx={d.x}
                cy={d.y}
                r={selected ? d.r + 1.8 : d.r}
                fill={KIND_FILL[d.kind]}
                stroke={d.kind === "asleep" ? (selected ? "#b45309" : "#d1d5db") : selected ? "#111827" : "none"}
                strokeWidth={d.kind === "asleep" ? 1.2 : selected ? 1.6 : 0}
                className="cursor-pointer lab-settle"
                style={{
                  opacity: dimmed ? 0.2 : undefined,
                  transition: "opacity 200ms ease",
                  animationDelay: `${(mix(hash(`${data.key}d${d.i}`)) % 20) * 30}ms`,
                }}
                onMouseEnter={() => setHover(d)}
                onClick={() => setPin(pin?.i === d.i ? null : d)}
              />
            );
          })}
          {/* zone labels along the baseline */}
          {zoneLabels.map(({ key, label, tone }) => {
            const [z0, z1] = ZONES[key];
            return (
              <text
                key={key}
                x={r2(X0 + ((z0 + z1) / 2) * (X1 - X0))}
                y={150}
                fontSize={8}
                fontFamily="var(--font-geist-mono)"
                fill={tone}
                fontWeight={key === "asleep" && data.dueNow > 20 ? 700 : 400}
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="h-[52px] mx-3 mb-2.5 mt-1">
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
              reviews push words <span className="text-heading font-semibold">→ right</span>; neglect pulls
              them <span className={cn("font-semibold", data.dueNow > 20 ? "text-amber-600" : "text-heading")}>← left</span>
            </span>
            <span className="ml-auto text-disabled shrink-0">hover or tap a dot</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
