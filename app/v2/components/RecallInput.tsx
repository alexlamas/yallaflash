"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeckFrame } from "./DeckFrame";
import type { Widget } from "@/app/v2/lib/types";

type RecallInputWidget = Extract<Widget, { type: "recall_input" }>;

export function RecallInput({
  widget,
  onAnswer,
  active = false,
}: {
  widget: RecallInputWidget;
  onAnswer: (wordId: string, tier: RecallInputWidget["tier"], submitted: string) => void;
  active?: boolean;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onAnswer(widget.word_id, widget.tier, value.trim());
  };

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
        <div className="flex gap-2">
          <Input
            value={value}
            disabled={submitted}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type the English meaning..."
            autoFocus={active}
          />
          <Button disabled={submitted || !value.trim()} onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return active ? <DeckFrame>{card}</DeckFrame> : card;
}
