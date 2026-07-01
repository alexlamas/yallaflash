"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeckFrame } from "./DeckFrame";
import type { Widget } from "@/app/v2/lib/types";

type QuizMCWidget = Extract<Widget, { type: "quiz_mc" }>;

export function QuizMC({
  widget,
  onAnswer,
  active = false,
}: {
  widget: QuizMCWidget;
  onAnswer: (wordId: string, tier: QuizMCWidget["tier"], submitted: string) => void;
  active?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(option);
    onAnswer(widget.word_id, widget.tier, option);
  };

  // Number keys pick options while this card is the active one.
  useEffect(() => {
    if (!active || selected) return;
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
    <Card className={cn(active ? "rounded-3xl shadow-lg" : "max-w-sm")}>
      <CardContent className={cn("space-y-3", active ? "p-7 text-center" : "p-4")}>
        {widget.cue.script && (
          <div className={active ? "text-4xl" : "text-2xl"} dir="rtl">
            {widget.cue.script}
          </div>
        )}
        <div className={active ? "text-2xl font-semibold" : "text-lg font-medium"}>
          {widget.cue.arabizi}
        </div>
        <div className="text-sm text-subtle">{widget.prompt}</div>
        <div className="grid gap-2 pt-1">
          {widget.options.map((option, index) => (
            <Button
              key={option}
              variant="outline"
              className={cn(
                "justify-start h-auto py-2.5 text-left whitespace-normal",
                selected === option && "border-primary"
              )}
              disabled={selected !== null}
              onClick={() => handleSelect(option)}
            >
              {active && (
                <span className="mr-2 text-xs text-disabled border rounded px-1.5 py-0.5">
                  {index + 1}
                </span>
              )}
              {option}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return active ? <DeckFrame>{card}</DeckFrame> : card;
}
