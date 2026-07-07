"use client";

// Variant K — "Synapses"
// The other literal answer: see the brain itself. Each word is a neuron;
// synapses connect neighbors. Strong memories glow green with soft halos,
// fading ones cool to ember amber, forgotten ones go dark — and their
// synapses dim with them. A backlog looks like a mind going quiet;
// reviewing lights the network back up.

import { useState } from "react";
import { type Scenario, VOCAB_LOOKUP } from "./fixtures";
import { Card, Eyebrow, MissionChassis, hash } from "./chassis";

type Kind = "strong" | "ok" | "fading" | "asleep";
type Node = { i: number; arabizi: string; english: string; kind: Kind; x: number; y: number };

const NODE_FILL: Record<Kind, string> = {
  strong: "#16a34a",
  ok: "#4ade80",
  fading: "#f59e0b",
  asleep: "#d1d5db",
};

const KIND_LABEL: Record<Kind, string> = {
  strong: "firing strong",
  ok: "settled",
  fading: "cooling — review soon",
  asleep: "gone dark — needs a review",
};

function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const SHOWN = 42;
// R2 low-discrepancy sequence constants — even, organic-feeling scatter.
const A1 = 0.7548776662;
const A2 = 0.5698402909;

function buildNetwork(data: Scenario): { nodes: Node[]; edges: [Node, Node][] } {
  const total = data.counts.new + data.counts.learning + data.counts.learned;
  const started = total - data.counts.new;
  const asleepShare = data.dueNow / Math.max(started, 1);
  const nodes: Node[] = [];
  for (let i = 0; i < SHOWN; i++) {
    const h = mix(hash(`${data.key}nr${i}`));
    const jx = ((h % 100) / 100 - 0.5) * 14;
    const jy = (((h >>> 8) % 100) / 100 - 0.5) * 12;
    const p = ((h >>> 16) % 1000) / 1000;
    let kind: Kind;
    if (p < asleepShare) kind = "asleep";
    else {
      const s = (h >>> 4) % 100;
      kind = s > 55 ? "strong" : s > 18 ? "ok" : "fading";
    }
    const [arabizi, english] = VOCAB_LOOKUP[(h >>> 5) % VOCAB_LOOKUP.length];
    nodes.push({
      i,
      arabizi,
      english,
      kind,
      x: r2(20 + ((i * A1) % 1) * 248 + jx),
      y: r2(20 + ((i * A2) % 1) * 158 + jy),
    });
  }
  // Synapses: each neuron reaches for its two nearest neighbors.
  const edges: [Node, Node][] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const nearest = nodes
      .filter((m) => m.i !== n.i)
      .sort((a, b) => (a.x - n.x) ** 2 + (a.y - n.y) ** 2 - ((b.x - n.x) ** 2 + (b.y - n.y) ** 2))
      .slice(0, 2);
    for (const m of nearest) {
      const key = n.i < m.i ? `${n.i}-${m.i}` : `${m.i}-${n.i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([n, m]);
      }
    }
  }
  return { nodes, edges };
}

export function SynapseVariant({ data, onAction }: { data: Scenario; onAction: (a: string) => void }) {
  const [pin, setPin] = useState<Node | null>(null);
  const [hover, setHover] = useState<Node | null>(null);
  const sel = pin ?? hover;
  const { nodes, edges } = buildNetwork(data);
  const dark = nodes.filter((n) => n.kind === "asleep").length;

  const hero = (
    <Card onMouseLeave={() => setHover(null)}>
      <div className="px-4 pt-3">
        <Eyebrow right={`${dark}/${SHOWN} dark`}>Synapses</Eyebrow>
      </div>
      <svg
        viewBox="0 0 288 198"
        className="w-full block"
        role="img"
        aria-label={`Your memory network: ${dark} of ${SHOWN} sampled words have gone dark`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setPin(null);
            setHover(null);
          }
        }}
      >
        {/* synapses first, under the neurons */}
        {edges.map(([a, b]) => {
          const alive = a.kind !== "asleep" && b.kind !== "asleep";
          const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.18;
          const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.18;
          const involved = sel !== null && (sel.i === a.i || sel.i === b.i);
          return (
            <path
              key={`${a.i}-${b.i}`}
              d={`M ${a.x} ${a.y} Q ${r2(mx)} ${r2(my)} ${b.x} ${b.y}`}
              fill="none"
              stroke={alive ? "#16a34a" : "#9ca3af"}
              strokeWidth={involved ? 1.3 : 0.8}
              opacity={sel !== null && !involved ? 0.06 : alive ? 0.3 : 0.12}
              style={{ transition: "opacity 200ms ease" }}
            />
          );
        })}
        {/* halos on live neurons */}
        {nodes
          .filter((n) => n.kind === "strong")
          .map((n) => (
            <circle key={`h${n.i}`} cx={n.x} cy={n.y} r={7.5} fill="#22c55e" className="lab-glow" />
          ))}
        {/* neurons */}
        {nodes.map((n) => {
          const selected = sel?.i === n.i;
          const dimmed = sel !== null && !selected;
          return (
            <circle
              key={n.i}
              cx={n.x}
              cy={n.y}
              r={selected ? 5 : n.kind === "strong" ? 3.4 : n.kind === "asleep" ? 2.6 : 3}
              fill={NODE_FILL[n.kind]}
              stroke={selected ? "#111827" : "none"}
              strokeWidth={selected ? 1.5 : 0}
              style={{ opacity: dimmed ? 0.25 : 1, transition: "opacity 200ms ease" }}
              className="cursor-pointer"
              onMouseEnter={() => setHover(n)}
              onClick={() => setPin(pin?.i === n.i ? null : n)}
            />
          );
        })}
      </svg>
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
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-600 inline-block" /> firing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> cooling
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> dark
            </span>
            <span className="ml-auto text-disabled">hover or tap</span>
          </div>
        )}
      </div>
    </Card>
  );

  return <MissionChassis data={data} onAction={onAction} hero={hero} />;
}
