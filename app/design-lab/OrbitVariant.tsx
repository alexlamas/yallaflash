"use client";

// Variant G — "Orbit"
// Signature: spaced repetition made spatial. Full-circle time rings
// (review zone / 24h / 1w / 1m+); every word is a bead on its ring that
// falls inward as its review approaches. Orbiting words drift slowly with
// faint motion trails; due words have landed in the center as a sunflower
// spiral (phyllotaxis) around the count.

import { useState } from "react";
import { type Scenario, VOCAB_LOOKUP } from "./fixtures";
import { Card, Eyebrow, MissionChassis, hash } from "./chassis";

type Sat = {
  i: number;
  arabizi: string;
  english: string;
  due: boolean;
  x: number;
  y: number;
  angle: number;
  ring: number;
  strong: boolean;
};

const CX = 144;
const CY = 124;
const RINGS = [32, 62, 89, 114]; // review zone, 24h, 1w, 1m+

// Round to 2 decimals so SSR and client render identical markup (raw
// sin/cos low bits differ between environments → hydration mismatch).
const r2 = (v: number) => Math.round(v * 100) / 100;

// The plain string hash maps consecutive suffixes ("sat4" / "sat5") to
// consecutive values, which chains satellites into near-identical spots.
// An avalanche mix decorrelates them.
function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

const GOLDEN = 2.399963; // radians — phyllotaxis angle

function place(data: Scenario): Sat[] {
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const shown = Math.min(total, 96);
  const dueShown = Math.round((data.dueNow / total) * shown);
  const sats: Sat[] = [];
  // Landed words: a sunflower spiral filling the review zone from its heart.
  const spiralC = (RINGS[0] - 11) / Math.sqrt(Math.max(dueShown, 1));
  for (let i = 0; i < dueShown; i++) {
    const rr = 5 + spiralC * Math.sqrt(i);
    const th = i * GOLDEN;
    const [arabizi, english] = VOCAB_LOOKUP[i % VOCAB_LOOKUP.length];
    sats.push({
      i,
      arabizi,
      english,
      due: true,
      x: r2(rr * Math.cos(th)),
      y: r2(rr * Math.sin(th)),
      angle: th,
      ring: 0,
      strong: false,
    });
  }
  // Orbiting words: beads sitting on their time ring.
  for (let i = dueShown; i < shown; i++) {
    const h = mix(hash(`${data.key}sat${i}`));
    const angle = ((h % 3600) / 10) * (Math.PI / 180);
    const band = (h >>> 2) % 3; // 24h / 1w / 1m+
    const rr = RINGS[band + 1] + (((h >>> 5) % 100) / 100 - 0.5) * 5;
    const [arabizi, english] = VOCAB_LOOKUP[i % VOCAB_LOOKUP.length];
    sats.push({
      i,
      arabizi,
      english,
      due: false,
      x: r2(rr * Math.cos(angle)),
      y: r2(rr * Math.sin(angle)),
      angle,
      ring: rr,
      strong: (h >>> 7) % 3 !== 0,
    });
  }
  return sats;
}

// Short arc trailing each orbiting bead, in its direction of travel.
function trailPath(s: Sat): string {
  const a1 = s.angle - 0.3;
  const a2 = s.angle - 0.09;
  return `M ${r2(s.ring * Math.cos(a1))} ${r2(s.ring * Math.sin(a1))} A ${r2(s.ring)} ${r2(s.ring)} 0 0 1 ${r2(
    s.ring * Math.cos(a2)
  )} ${r2(s.ring * Math.sin(a2))}`;
}

export function OrbitVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  // Hover previews (sticky, so the cursor can travel to the quiz button);
  // click/tap pins — the only path on touch, where the panel actually ships.
  const [pin, setPin] = useState<Sat | null>(null);
  const [hover, setHover] = useState<Sat | null>(null);
  const sel = pin ?? hover;
  const sats = place(data);
  const orbiting = sats.filter((s) => !s.due);
  const landed = sats.filter((s) => s.due);

  const satCircle = (s: Sat) => {
    const selected = sel?.i === s.i;
    const dimmed = sel !== null && !selected;
    return (
      <circle
        key={s.i}
        cx={s.x}
        cy={s.y}
        r={selected ? 4.6 : s.due ? 2.3 : s.strong ? 2.9 : 2.5}
        fill={s.due ? "#dc2626" : s.strong ? "#16a34a" : "#86bc4b"}
        stroke={selected ? "#111827" : "none"}
        strokeWidth={selected ? 1.5 : 0}
        style={{ opacity: dimmed ? 0.25 : s.due || s.strong ? 1 : 0.9, transition: "opacity 200ms ease" }}
        className="cursor-pointer"
        onMouseEnter={() => setHover(s)}
        onClick={() => setPin(pin?.i === s.i ? null : s)}
      />
    );
  };

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right="closer = due sooner">Review orbit</Eyebrow>
      </div>
      <svg
        viewBox="0 0 288 250"
        className="w-full block"
        role="img"
        aria-label={`Review orbit: ${data.dueNow} words in the review zone`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setPin(null);
            setHover(null);
          }
        }}
      >
        <defs>
          <radialGradient id={`zone-${data.key}`}>
            <stop offset="0%" stopColor={data.dueNow > 0 ? "#fecaca" : "#dcfce7"} stopOpacity={0.9} />
            <stop offset="78%" stopColor={data.dueNow > 0 ? "#fee2e2" : "#f0fdf4"} stopOpacity={0.55} />
            <stop offset="100%" stopColor={data.dueNow > 0 ? "#fef2f2" : "#f0fdf4"} stopOpacity={0.25} />
          </radialGradient>
        </defs>
        <g transform={`translate(${CX} ${CY})`}>
          {/* time rings */}
          <circle r={RINGS[0]} fill={`url(#zone-${data.key})`} className={data.dueNow > 0 ? "lab-zone" : undefined} />
          {RINGS.slice(1).map((r) => (
            <circle key={r} r={r} fill="none" stroke="#e5e7eb" strokeWidth={1} strokeDasharray="1.5 4.5" />
          ))}
          {/* orbiting words drift along their rings; landed words hold still */}
          <g className="lab-orbit" style={{ animationPlayState: sel && !sel.due ? "paused" : undefined }}>
            {orbiting.map((s) => (
              <path
                key={`t${s.i}`}
                d={trailPath(s)}
                fill="none"
                stroke={s.strong ? "#16a34a" : "#86bc4b"}
                strokeWidth={1.6}
                strokeLinecap="round"
                opacity={sel !== null && sel.i !== s.i ? 0.08 : 0.22}
              />
            ))}
            {orbiting.map(satCircle)}
          </g>
          {landed.map(satCircle)}
        </g>
        {/* due count, haloed so it stays legible over the cluster */}
        {data.dueNow > 0 && (
          <text
            x={CX}
            y={CY + 5}
            fontSize={15}
            fontWeight={700}
            fontFamily="var(--font-geist-mono)"
            fill="#dc2626"
            stroke="#ffffff"
            strokeWidth={4}
            paintOrder="stroke"
            textAnchor="middle"
          >
            {data.dueNow}
          </text>
        )}
        {/* ring labels stacked up the top axis */}
        {["now", "24h", "1w", "1m+"].map((label, i) => (
          <text
            key={label}
            x={CX}
            y={r2(CY - RINGS[i] - 3)}
            fontSize={7.5}
            fontFamily="var(--font-geist-mono)"
            fill="#9ca3af"
            stroke="#ffffff"
            strokeWidth={2.5}
            paintOrder="stroke"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>
      <div className="h-[52px] mx-3 mb-2.5 mt-0.5">
        {sel ? (
          <div className="h-full flex items-center gap-3 rounded-lg bg-gray-50 px-3">
            <div className="flex-1 min-w-0 leading-tight">
              <div className="truncate">
                <span className="text-sm font-semibold text-heading">{sel.arabizi}</span>
                <span className="ml-2 text-xs text-subtle">{sel.english}</span>
              </div>
              <div className="font-mono text-[10px] text-disabled mt-0.5">
                {sel.due ? "landed — in the review zone now" : "in orbit — comes due later"}
              </div>
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
              <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
              due <span className="tabular-nums">{data.dueNow}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
              in orbit
            </span>
            <span className="ml-auto text-disabled">hover or tap a word</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
