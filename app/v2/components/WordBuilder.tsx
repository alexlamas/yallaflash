"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flavorStyles } from "@/app/v2/lib/cardFlavors";
import type { Widget } from "@/app/v2/lib/types";

type WordBuilderWidget = Extract<Widget, { type: "word_builder" }>;

// Scaffolded production: assemble the word from its own scrambled tiles.
// Tap tiles (or type letters) to build; tap a placed tile to take it back.
// The submitted string is the assembled tiles, graded like a reversed card.
export function WordBuilder({
  widget,
  onAnswer,
  active = false,
  answered = false,
}: {
  widget: WordBuilderWidget;
  onAnswer: (wordId: string, tier: WordBuilderWidget["tier"], submitted: string) => Promise<boolean>;
  active?: boolean;
  // Durable answered state -- local state resets on remount, which once
  // brought an old card back to life.
  answered?: boolean;
}) {
  // Picked tile INDEXES in tap order -- duplicate letters need to stay
  // distinguishable, so tiles are tracked by position, not value.
  const [picked, setPicked] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const done = answered || submitted;
  const styles = flavorStyles(widget.flavor);
  // The bank may hold decoy tiles beyond the answer's length; older
  // persisted widgets lack `size` and there every tile is part of it.
  const answerSize = widget.size ?? widget.tiles.length;
  const complete = picked.length === answerSize;
  const assembled = picked.map((i) => widget.tiles[i]).join(widget.separator);

  const pickTile = (index: number) => {
    if (done || complete || picked.includes(index)) return;
    setPicked((prev) => [...prev, index]);
  };

  const unpick = (position: number) => {
    if (done) return;
    setPicked((prev) => prev.filter((_, p) => p !== position));
  };

  const handleSubmit = async () => {
    if (done || !complete) return;
    setSubmitted(true);
    // A failed grade re-enables the card so the assembly can be resubmitted
    // -- a network blip must not wedge the review.
    const ok = await onAnswer(widget.word_id, widget.tier, assembled);
    if (!ok) setSubmitted(false);
  };

  // Physical keyboard works too: a letter picks the first unused matching
  // tile (letter mode only -- word tiles have no single-key mapping),
  // Backspace takes the last one back, Enter submits a complete build.
  useEffect(() => {
    if (!active || done) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        setPicked((prev) => prev.slice(0, -1));
        return;
      }
      if (event.key === "Enter") {
        handleSubmit();
        return;
      }
      if (widget.separator !== "" || event.key.length !== 1) return;
      const key = event.key.toLowerCase();
      const index = widget.tiles.findIndex((tile, i) => !picked.includes(i) && tile.toLowerCase() === key);
      if (index !== -1) pickTile(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, picked, widget.tiles]);

  const tileClass = cn(
    "rounded-lg border border-b-2 font-medium transition-[background-color,border-color,color,opacity,transform] active:scale-[0.94]",
    widget.separator === " " ? "px-3 py-2 text-sm" : "min-w-9 px-2.5 py-2 text-base",
    styles.option
  );

  const card = (
    <Card className={cn(active ? "w-full max-w-md mx-auto rounded-2xl shadow-lg" : "max-w-sm", styles.card)}>
      <CardContent className={cn("space-y-3", active ? "p-7 text-center" : "p-4")}>
        {widget.image_url && active && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={widget.image_url}
            alt=""
            className="h-24 w-24 rounded-xl object-cover mx-auto outline outline-1 -outline-offset-1 outline-black/10"
          />
        )}
        <div className={cn(active ? "text-3xl font-title" : "text-lg font-medium", styles.cue)}>
          {widget.cue.english}
        </div>
        {widget.cue.memory_hook && <div className={cn("text-xs", styles.muted)}>{widget.cue.memory_hook}</div>}
        <div className={cn("text-sm", styles.muted)}>{widget.prompt}</div>

        {/* The build row: placed tiles in order; tap one to take it back. */}
        <div
          aria-label="Your answer so far"
          className={cn(
            "flex flex-wrap items-center justify-center gap-1.5 min-h-12 rounded-xl border border-dashed px-3 py-2",
            styles.frame
          )}
        >
          {picked.length === 0 ? (
            <span className={cn("text-xs", styles.muted)}>
              {widget.tiles.length > answerSize
                ? "Tap the tiles below to build it — some won't be used"
                : "Tap the tiles below to build it"}
            </span>
          ) : (
            picked.map((tileIndex, position) => (
              <button
                key={`${tileIndex}-${position}`}
                onClick={() => unpick(position)}
                disabled={done}
                aria-label={`Remove "${widget.tiles[tileIndex]}"`}
                className={tileClass}
              >
                {widget.tiles[tileIndex]}
              </button>
            ))
          )}
        </div>

        {/* The tile bank: used tiles stay in place as ghosts, so nothing
            jumps around mid-puzzle. */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {widget.tiles.map((tile, index) => {
            const used = picked.includes(index);
            return (
              <button
                key={index}
                onClick={() => pickTile(index)}
                disabled={done || used || complete}
                aria-label={used ? `"${tile}" already placed` : `Add "${tile}"`}
                className={cn(tileClass, used && "opacity-25")}
              >
                {tile}
              </button>
            );
          })}
        </div>

        <Button disabled={done || !complete} onClick={handleSubmit} className={cn("w-full", styles.button)}>
          Submit
        </Button>
      </CardContent>
    </Card>
  );

  return card;
}
