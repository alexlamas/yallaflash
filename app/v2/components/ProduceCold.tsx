"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Widget } from "@/app/v2/lib/types";

type ProduceColdWidget = Extract<Widget, { type: "produce_cold" }>;

export function ProduceCold({
  widget,
  onAnswer,
}: {
  widget: ProduceColdWidget;
  onAnswer: (wordId: string, tier: ProduceColdWidget["tier"], submitted: string) => void;
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
        <div className="text-lg font-medium">{widget.cue.english}</div>
        {widget.cue.memory_hook && <div className="text-xs text-subtle">{widget.cue.memory_hook}</div>}
        <div className="text-sm text-subtle">{widget.prompt}</div>
        <div className="flex gap-2">
          <Input
            value={value}
            disabled={submitted}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Arabizi, from memory..."
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
