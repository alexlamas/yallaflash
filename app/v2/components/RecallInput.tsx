"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE } from "@/app/v2/lib/language";
import { flavorStyles } from "@/app/v2/lib/cardFlavors";
import { ContextSentence } from "./ReviewContext";
import { IDontKnow } from "./IDontKnow";
import type { Widget } from "@/app/v2/lib/types";

type RecallInputWidget = Extract<Widget, { type: "recall_input" }>;

export function RecallInput({
  widget,
  onAnswer,
  onConcede,
  active = false,
  answered = false,
}: {
  widget: RecallInputWidget;
  onAnswer: (wordId: string, tier: RecallInputWidget["tier"], submitted: string) => Promise<boolean>;
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

  const cueWord = widget.cue.arabizi ?? "";
  const card = (
    <Card className={cn(active ? "w-full max-w-md mx-auto rounded-2xl shadow-lg" : "max-w-sm", styles.card)}>
      <CardContent className={cn("space-y-3", active ? "p-7 text-center" : "p-4")}>
        {widget.cue.script && (
          <div
            className={active ? (widget.cue.script.length > 16 ? "text-2xl" : "text-4xl") : "text-2xl"}
            dir={DEFAULT_LANGUAGE.scriptDir}
          >
            {widget.cue.script}
          </div>
        )}
        {/* Sentence-length "words" step the display font down so they read
            as a sentence, not a shout. */}
        <div
          className={cn(
            active ? (cueWord.length > 28 ? "text-xl font-title" : "text-3xl font-title") : "text-lg font-medium",
            styles.cue
          )}
        >
          {widget.cue.arabizi}
        </div>
        {widget.context && (
          <ContextSentence
            text={widget.context.target}
            highlight={widget.cue.arabizi}
            className={styles.context}
            highlightClassName={styles.highlight}
          />
        )}
        <div className={cn("text-sm", styles.muted)}>{widget.prompt}</div>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={value}
            disabled={done}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type the English meaning..."
            aria-label={widget.prompt}
            autoFocus={active}
            // Quiz answers: auto-capitalize would dress up every answer and
            // enter should read as submitting one.
            autoCapitalize="none"
            enterKeyHint="send"
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
