"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE } from "@/app/v2/lib/language";
import { flavorStyles } from "@/app/v2/lib/cardFlavors";
import { ContextSentence } from "./ReviewContext";
import type { Widget } from "@/app/v2/lib/types";

type ProduceColdWidget = Extract<Widget, { type: "produce_cold" }>;

export function ProduceCold({
  widget,
  onAnswer,
  active = false,
  answered = false,
}: {
  widget: ProduceColdWidget;
  onAnswer: (wordId: string, tier: ProduceColdWidget["tier"], submitted: string) => Promise<boolean>;
  active?: boolean;
  // Durable answered state -- local state resets on remount, which once
  // brought an old card back to life with a live input.
  answered?: boolean;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const done = answered || submitted;
  const styles = flavorStyles(widget.flavor);

  const handleSubmit = async () => {
    if (done || !value.trim()) return;
    setSubmitted(true);
    // A failed grade re-enables the card so the typed answer can be
    // resubmitted -- otherwise a network blip wedges the review.
    const ok = await onAnswer(widget.word_id, widget.tier, value.trim());
    if (!ok) setSubmitted(false);
  };

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
        {widget.context && (
          // Cloze: the word arrives already blanked out of the sentence, so
          // showing the translation alongside is leak-safe on this tier.
          <ContextSentence
            text={widget.context.target}
            translation={widget.context.english}
            className={styles.context}
          />
        )}
        <div className={cn("text-sm", styles.muted)}>{widget.prompt}</div>
        <div className="flex gap-2">
          <Input
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
      </CardContent>
    </Card>
  );

  return card;
}
