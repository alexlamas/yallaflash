"use client";

// Design lab for the V2 progress panel redesign — round 3.
// Two finalists (Memory field, Orbit) on the shared mission-control
// chassis, with motion and focus states. Temporary; deleted when done.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SCENARIOS, type Scenario } from "./fixtures";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { FoldVariant } from "./FoldVariant";

const VARIANTS: {
  key: string;
  name: string;
  axis: string;
  why: string;
  Component: React.ComponentType<{ data: Scenario; onAction: (a: string) => void }>;
}[] = [
  {
    key: "P",
    name: "The fold — final candidate",
    axis: "Words in memory order, hover expands in place",
    why: "Your words strongest-first, fading by weight → opacity → blur, the amber fold where the asleep ones begin. Hovering a word scales it up in place — pure transform, so lines never re-wrap and nothing shifts. Tap pins it; the card offers the quiz.",
    Component: FoldVariant,
  },
];

// Lab-only keyframes. lab-settle: staggered dot entrance. lab-orbit: slow
// elliptical drift (rotation inside the squashed plane). lab-zone: soft
// pulse on the due zone. All disabled under prefers-reduced-motion.
const LAB_CSS = `
@keyframes lab-settle { from { opacity: 0 } to { opacity: 1 } }
.lab-settle { animation: lab-settle 500ms ease-out backwards; }
@keyframes lab-orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
.lab-orbit { animation: lab-orbit 160s linear infinite; transform-origin: 0 0; }
@keyframes lab-zone { 0%, 100% { fill-opacity: 0.55 } 50% { fill-opacity: 1 } }
.lab-zone { animation: lab-zone 4.5s ease-in-out infinite; }
@keyframes lab-glow { 0%, 100% { opacity: 0.1 } 50% { opacity: 0.26 } }
.lab-glow { animation: lab-glow 5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lab-settle, .lab-orbit, .lab-zone, .lab-glow { animation: none !important; }
}
`;

export default function DesignLabPage() {
  const [scenarioKey, setScenarioKey] = useState<"backlog" | "healthy">("backlog");
  const [actions, setActions] = useState<string[]>([]);
  const scenario = SCENARIOS[scenarioKey];

  // The app's offline service worker caches /_next assets on localhost and
  // has repeatedly served stale CSS/JS for this page. Evict it here so the
  // lab always renders current code.
  useEffect(() => {
    navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()));
    if ("caches" in window) {
      caches.keys().then((keys) =>
        keys.forEach((k) => {
          if (k.startsWith("arabic-flashcards-")) caches.delete(k);
        })
      );
    }
  }, []);

  const onAction = (a: string) => setActions((prev) => [a, ...prev].slice(0, 3));

  return (
    <div className="min-h-screen bg-gray-100">
      <style>{LAB_CSS}</style>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200 px-5 py-3">
        <div className="max-w-[1000px] mx-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Design lab — ProgressPanel: the fold, final</h1>
            <p className="text-xs text-gray-500">
              The pick. Hover words to expand-in-place (no re-wrapping), flip the toggle for both states.
              Confirm and I&apos;ll tear the lab down and build it into the real panel.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 ml-auto" role="tablist" aria-label="Data scenario">
            {(Object.keys(SCENARIOS) as ("backlog" | "healthy")[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={scenarioKey === k}
                onClick={() => setScenarioKey(k)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  scenarioKey === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {k === "backlog" ? "😵 Backlog (126 due)" : "😌 Healthy"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-5 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start justify-items-center">
          {VARIANTS.map(({ key, name, axis, why, Component }) => (
            <section key={key} data-variant={key} className="flex flex-col w-full max-w-[420px]">
              <div className="mb-2.5 px-1">
                <div className="flex items-baseline gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {key}
                  </span>
                  <h2 className="text-sm font-semibold text-gray-900">{name}</h2>
                  <span className="text-[11px] text-gray-400">{axis}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed min-h-[80px]">{why}</p>
              </div>
              <div className="w-[375px] max-w-full mx-auto rounded-[2rem] border-[6px] border-gray-900 bg-gray-50 shadow-xl overflow-hidden">
                <div className="h-6 bg-gray-900 flex items-center justify-center">
                  <div className="w-16 h-3 rounded-full bg-black" />
                </div>
                <div className="h-[660px] overflow-y-auto overscroll-contain">
                  <Component data={scenario} onAction={onAction} />
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 max-w-[700px] mx-auto rounded-xl bg-white border border-gray-200 p-4 text-xs text-gray-600 leading-relaxed">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Judging V</h2>
          <ul className="space-y-1.5 list-disc pl-4">
            <li>
              Step the beats: the page dims and refocuses under each sentence; beat 2 spotlights the fold,
              beat 3 relights the three rescue words the prose names.
            </li>
            <li>
              <strong>Flip the toggle</strong>: every sentence rewrites itself; the fold moves; healthy beat 2
              becomes a small brag.
            </li>
            <li>
              In production, the beats would play once on open (or only after an absence), then settle into
              the quiet fold view — the stepper is for judging all three states here.
            </li>
          </ul>
        </section>
      </main>

      {actions.length > 0 && (
        <div className="fixed bottom-4 left-4 z-[60] w-[300px] rounded-xl bg-gray-900 text-white shadow-2xl px-4 py-3" data-feedback-ui="true">
          <div className="text-[10px] font-mono tracking-widest text-gray-400 mb-1.5">→ SENT TO TUTOR CHAT</div>
          {actions.map((a, i) => (
            <div key={i} className={cn("text-xs font-mono py-0.5", i === 0 ? "text-green-400" : "text-gray-500")}>
              “{a}”
            </div>
          ))}
        </div>
      )}

      <FeedbackOverlay targetName="ProgressPanel" />
    </div>
  );
}
