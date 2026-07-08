"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE } from "@/app/v2/lib/language";
import { flavorStyles } from "@/app/v2/lib/cardFlavors";
import { splitCueAside } from "@/app/v2/lib/leakGuard";
import { ContextSentence } from "./ReviewContext";
import { IDontKnow } from "./IDontKnow";
import type { Widget } from "@/app/v2/lib/types";

type ProduceColdWidget = Extract<Widget, { type: "produce_cold" }>;

export function ProduceCold({
  widget,
  onAnswer,
  onConcede,
  active = false,
  answered = false,
}: {
  widget: ProduceColdWidget;
  onAnswer: (wordId: string, tier: ProduceColdWidget["tier"], submitted: string) => Promise<boolean>;
  onConcede?: () => void;
  active?: boolean;
  // Durable answered state -- local state resets on remount, which once
  // brought an old card back to life with a live input.
  answered?: boolean;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = answered || submitted;
  const styles = flavorStyles(widget.flavor);

  // Typing anywhere answers THIS card while it's on stage: refocus the
  // answer field and keep the keystroke, so clicking away never eats input.
  useEffect(() => {
    if (!active || done) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      event.preventDefault();
      setValue((current) => current + event.key);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, done]);

  const handleSubmit = async () => {
    if (done || !value.trim()) return;
    setSubmitted(true);
    // A failed grade re-enables the card so the typed answer can be
    // resubmitted -- otherwise a network blip wedges the review.
    const ok = await onAnswer(widget.word_id, widget.tier, value.trim());
    if (!ok) setSubmitted(false);
  };

  // Grammar asides move out of the headline into a small line; sentence-
  // length meanings step the display font down so they read as a sentence,
  // not a shout.
  const { main: cueMain, aside: cueAside } = splitCueAside(widget.cue.english ?? "");
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
        {/* Cloze cards let the sentence BE the card: the translation carries
            the meaning, the gap asks the question -- no English headline, no
            hook, no instruction line stacked on top (that read as a wall of
            text). The plain from-memory card keeps its cue-and-prompt shape. */}
        {widget.context ? (
          // The word arrives already blanked out of the sentence, so showing
          // the translation alongside is leak-safe on this tier.
          <ContextSentence
            text={widget.context.target}
            translation={widget.context.english}
            className={styles.context}
            large={active}
          />
        ) : (
          <>
            <div
              className={cn(
                active ? (cueMain.length > 28 ? "text-xl font-title" : "text-3xl font-title") : "text-lg font-medium",
                styles.cue
              )}
            >
              {cueMain}
            </div>
            {cueAside && <div className={cn("text-xs italic", styles.muted)}>{cueAside}</div>}
            {widget.cue.memory_hook && (
              <div className={cn("text-xs", styles.muted)}>{widget.cue.memory_hook}</div>
            )}
            <div className={cn("text-sm", styles.muted)}>{widget.prompt}</div>
          </>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={value}
            disabled={done}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={DEFAULT_LANGUAGE.producePlaceholder}
            aria-label={widget.prompt}
            autoFocus={active}
            className={styles.input}
          />
          <Button disabled={done || !value.trim()} onClick={handleSubmit} className={styles.button}>
            Submit
          </Button>
        </div>
        {active && !done && <IDontKnow onConcede={onConcede} className={styles.muted} />}
      </CardContent>
    </Card>
  );

  return card;
}
