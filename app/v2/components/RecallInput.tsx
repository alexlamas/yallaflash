"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Widget } from "@/app/v2/lib/types";

type RecallInputWidget = Extract<Widget, { type: "recall_input" }>;

export function RecallInput({
  widget,
  onAnswer,
}: {
  widget: RecallInputWidget;
  onAnswer: (wordId: string, tier: RecallInputWidget["tier"], submitted: string) => void;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onAnswer(widget.word_id, widget.tier, value.trim());
  };

  return (
    <Card className="max-w-sm">
      <CardContent className="p-4 space-y-3">
        {widget.cue.script && <div className="text-2xl" dir="rtl">{widget.cue.script}</div>}
        <div className="text-lg font-medium">{widget.cue.arabizi}</div>
        <div className="text-sm text-subtle">{widget.prompt}</div>
        <div className="flex gap-2">
          <Input
            value={value}
            disabled={submitted}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type the English meaning..."
            autoFocus
          />
          <Button disabled={submitted || !value.trim()} onClick={handleSubmit}>
            Submit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
