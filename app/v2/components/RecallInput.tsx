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

type RecallInputWidget = Extract<Widget, { type: "recall_input" }>;

export function RecallInput({
  widget,
  onAnswer,
  active = false,
  answered = false,
}: {
  widget: RecallInputWidget;
  onAnswer: (wordId: string, tier: RecallInputWidget["tier"], submitted: string) => Promise<boolean>;
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
        {widget.cue.script && (
          <div className={active ? "text-4xl" : "text-2xl"} dir={DEFAULT_LANGUAGE.scriptDir}>
            {widget.cue.script}
          </div>
        )}
        <div className={cn(active ? "text-3xl font-title" : "text-lg font-medium", styles.cue)}>
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
      </CardContent>
    </Card>
  );

  return card;
}
