import type { ProgressState } from "@/app/v2/lib/types";

interface ForestWord {
  id: string;
  status: ProgressState;
}

// Deterministic placement: the same word always grows in the same spot.
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

const MAX_PLANTS = 90;

// Depth bands, far to near. Each band's plants render between hill layers so
// nearer hills occlude the bases of farther trees.
const BANDS = [
  { baseY: 136, scale: 0.55 },
  { baseY: 162, scale: 0.75 },
  { baseY: 190, scale: 1 },
];

function Cedar({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-2} y={-13} width={4} height={13} rx={1} fill="#8b5a2b" />
      <ellipse cx={0} cy={-15} rx={15} ry={4.5} fill="#14532d" />
      <ellipse cx={0} cy={-22} rx={11.5} ry={4} fill="#166534" />
      <ellipse cx={0} cy={-28.5} rx={8} ry={3.5} fill="#14532d" />
      <ellipse cx={0} cy={-34} rx={4.5} ry={3} fill="#166534" />
    </g>
  );
}

function Sapling({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-1.2} y={-7} width={2.4} height={7} rx={1} fill="#8b5a2b" />
      <ellipse cx={0} cy={-9} rx={6} ry={4} fill="#15803d" />
      <ellipse cx={0} cy={-13} rx={3.5} ry={2.5} fill="#166534" />
    </g>
  );
}

function Sprout({ x, y, s }: { x: number; y: number; s: number }) {
  // Sprouts render ~1.5x their band scale -- at natural scale they read as
  // specks and new words look like nothing was planted.
  return (
    <g transform={`translate(${x},${y}) scale(${s * 1.5})`}>
      <path d="M0,0 C0,-2.5 0,-4.5 0,-6" stroke="#65a30d" strokeWidth={1.4} fill="none" />
      <ellipse cx={-2.4} cy={-6.5} rx={2.8} ry={1.7} fill="#84cc16" transform="rotate(-24 -2.4 -6.5)" />
      <ellipse cx={2.4} cy={-7} rx={2.8} ry={1.7} fill="#65a30d" transform="rotate(22 2.4 -7)" />
    </g>
  );
}

function Plant({ word, x, y, s }: { word: ForestWord; x: number; y: number; s: number }) {
  if (word.status === "learned") return <Cedar x={x} y={y} s={s} />;
  if (word.status === "learning") return <Sapling x={x} y={y} s={s} />;
  return <Sprout x={x} y={y} s={s} />;
}

export function CedarForest({ words }: { words: ForestWord[] }) {
  const bands: { word: ForestWord; x: number; y: number; s: number }[][] = [[], [], []];

  for (const word of words.slice(0, MAX_PLANTS)) {
    const bandIndex = hash(`${word.id}band`) % BANDS.length;
    const band = BANDS[bandIndex];
    bands[bandIndex].push({
      word,
      x: 14 + (hash(word.id) % 260),
      y: band.baseY + ((hash(`${word.id}y`) % 7) - 3),
      s: band.scale,
    });
  }
  for (const band of bands) band.sort((a, b) => a.y - b.y);

  return (
    <svg viewBox="0 0 288 200" className="w-full block" role="img" aria-label="Your cedar forest">
      {/* sky */}
      <rect x={0} y={0} width={288} height={200} fill="#e0f2fe" />
      <circle cx={244} cy={34} r={16} fill="#fbbf24" opacity={0.9} />
      <ellipse cx={70} cy={38} rx={26} ry={8} fill="#ffffff" opacity={0.85} />
      <ellipse cx={92} cy={44} rx={20} ry={6} fill="#ffffff" opacity={0.7} />
      <ellipse cx={182} cy={62} rx={22} ry={6.5} fill="#ffffff" opacity={0.75} />

      {/* mountains */}
      <path d="M0,142 L62,82 L116,142 Z" fill="#cbd5e1" opacity={0.8} />
      <path d="M88,142 L152,68 L220,142 Z" fill="#b9cadd" opacity={0.8} />
      <path d="M196,142 L248,94 L288,142 Z" fill="#cbd5e1" opacity={0.8} />

      {/* hills interleaved with depth bands of plants */}
      <path d="M0,140 Q72,104 144,124 T288,132 L288,200 L0,200 Z" fill="#86efac" />
      {bands[0].map((p) => (
        <Plant key={p.word.id} word={p.word} x={p.x} y={p.y} s={p.s} />
      ))}
      <path d="M0,164 Q96,132 192,152 T288,158 L288,200 L0,200 Z" fill="#4ade80" />
      {bands[1].map((p) => (
        <Plant key={p.word.id} word={p.word} x={p.x} y={p.y} s={p.s} />
      ))}
      <path d="M0,192 Q72,168 160,182 T288,186 L288,200 L0,200 Z" fill="#22c55e" />
      {bands[2].map((p) => (
        <Plant key={p.word.id} word={p.word} x={p.x} y={p.y} s={p.s} />
      ))}
    </svg>
  );
}
