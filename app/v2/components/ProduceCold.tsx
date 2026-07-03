"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeckFrame } from "./DeckFrame";
import type { Widget } from "@/app/v2/lib/types";

type ProduceColdWidget = Extract<Widget, { type: "produce_cold" }>;

export function ProduceCold({
  widget,
  onAnswer,
  active = false,
  answered = false,
}: {
  widget: ProduceColdWidget;
  onAnswer: (wordId: string, tier: ProduceColdWidget["tier"], submitted: string) => void;
  active?: boolean;
  // Durable answered state -- local state resets on remount, which once
  // brought an old card back to life with a live input.
  answered?: boolean;
}) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const done = answered || submitted;

  const handleSubmit = () => {
    if (done || !value.trim()) return;
    setSubmitted(true);
    onAnswer(widget.word_id, widget.tier, value.trim());
  };

  const card = (
    <Card className={cn(active ? "rounded-2xl shadow-lg" : "max-w-sm")}>
      <CardContent className={cn("space-y-3", active ? "p-7 text-center" : "p-4")}>
        <div className={active ? "text-3xl font-title" : "text-lg font-medium"}>
          {widget.cue.english}
        </div>
        {widget.cue.memory_hook && <div className="text-xs text-subtle">{widget.cue.memory_hook}</div>}
        <div className="text-sm text-subtle">{widget.prompt}</div>
        <div className="flex gap-2">
          <Input
            value={value}
            disabled={done}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Arabizi, from memory..."
            autoFocus={active}
          />
          <Button
            disabled={done || !value.trim()}
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700"
          >
            Submit
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return active ? <DeckFrame>{card}</DeckFrame> : card;
}
