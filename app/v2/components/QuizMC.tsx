"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Widget } from "@/app/v2/lib/types";

type QuizMCWidget = Extract<Widget, { type: "quiz_mc" }>;

export function QuizMC({
  widget,
  onAnswer,
}: {
  widget: QuizMCWidget;
  onAnswer: (wordId: string, tier: QuizMCWidget["tier"], submitted: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelected(option);
    onAnswer(widget.word_id, widget.tier, option);
  };

  return (
    <Card className="max-w-sm">
      <CardContent className="p-4 space-y-3">
        {widget.cue.script && <div className="text-2xl" dir="rtl">{widget.cue.script}</div>}
        <div className="text-lg font-medium">{widget.cue.arabizi}</div>
        <div className="text-sm text-subtle">{widget.prompt}</div>
        <div className="grid gap-2 pt-1">
          {widget.options.map((option) => (
            <Button
              key={option}
              variant="outline"
              className={cn(
                "justify-start h-auto py-2 text-left whitespace-normal",
                selected === option && "border-primary"
              )}
              disabled={selected !== null}
              onClick={() => handleSelect(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
