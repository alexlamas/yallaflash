"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE } from "@/app/v2/lib/language";
import { flavorStyles } from "@/app/v2/lib/cardFlavors";
import { ContextSentence } from "./ReviewContext";
import type { Widget } from "@/app/v2/lib/types";

type QuizMCWidget = Extract<Widget, { type: "quiz_mc" }>;

export function QuizMC({
  widget,
  onAnswer,
  active = false,
  answered = false,
}: {
  widget: QuizMCWidget;
  onAnswer: (wordId: string, tier: QuizMCWidget["tier"], submitted: string) => Promise<boolean>;
  active?: boolean;
  // Durable answered state from the conversation -- local state resets on
  // remount, which once brought an old card back to life.
  answered?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const done = answered || selected !== null;
  const styles = flavorStyles(widget.flavor);
  // Reversed cards cue with English and offer word options; the cue block
  // just renders whichever side the widget carries.
  const cueWord = widget.cue.arabizi ?? widget.cue.english;

  const handleSelect = async (option: string) => {
    if (done) return;
    setSelected(option);
    // A failed grade re-enables the options -- a network blip must not
    // wedge the card.
    const ok = await onAnswer(widget.word_id, widget.tier, option);
    if (!ok) setSelected(null);
  };

  // Number keys pick options while this card is the active one.
  useEffect(() => {
    if (!active || done) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const n = Number(event.key);
      if (n >= 1 && n <= widget.options.length) handleSelect(widget.options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selected, widget.options]);

  const card = (
    <Card className={cn(active ? "w-full max-w-md mx-auto rounded-2xl shadow-lg" : "max-w-sm", styles.card)}>
      <CardContent className={cn("space-y-3", active ? "p-7 text-center" : "p-4")}>
        {widget.cue.script && (
          <div className={active ? "text-4xl" : "text-2xl"} dir={DEFAULT_LANGUAGE.scriptDir}>
            {widget.cue.script}
          </div>
        )}
        <div className={cn(active ? "text-3xl font-title" : "text-lg font-medium", styles.cue)}>
          {cueWord}
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
        <div className="grid gap-2 pt-1">
          {widget.options.map((option, index) => (
            <Button
              key={option}
              variant="outline"
              className={cn(
                "justify-start h-auto py-2.5 text-left whitespace-normal",
                styles.option,
                // Neutral selected state -- the verdict card says right/wrong,
                // a green highlight here would imply "correct" prematurely.
                selected === option && styles.optionSelected
              )}
              disabled={done}
              onClick={() => handleSelect(option)}
            >
              {active && (
                <kbd
                  aria-hidden="true"
                  className={cn(
                    "mr-2 hidden sm:flex h-5 w-5 items-center justify-center rounded border border-b-2 font-mono text-[11px]",
                    styles.kbd
                  )}
                >
                  {index + 1}
                </kbd>
              )}
              {option}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return card;
}
