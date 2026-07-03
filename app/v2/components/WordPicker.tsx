"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Widget } from "@/app/v2/lib/types";

// Zero-due moment: fresh pack words offered for selection. Tapping rows
// toggles them (all start selected); confirming starts the SRS clock.
export function WordPicker({
  widget,
  onStartWords,
  answered = false,
}: {
  widget: Extract<Widget, { type: "word_picker" }>;
  onStartWords: (wordIds: string[]) => void;
  answered?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(widget.candidates.map((c) => c.id)));
  const [justConfirmed, setJustConfirmed] = useState(false);
  const confirmed = answered || justConfirmed;

  if (widget.candidates.length === 0) return null;

  if (confirmed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50/70 px-4 py-2 text-sm text-green-900">
        <Check className="h-4 w-4 text-green-700" />
        Started {selected.size} new word{selected.size === 1 ? "" : "s"}
      </div>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="max-w-md">
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">Fresh from the packs -- pick what to learn:</div>
        <div className="space-y-1.5">
          {widget.candidates.map((c) => {
            const isOn = selected.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  isOn ? "border-green-500 bg-green-50/70" : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    isOn ? "border-green-600 bg-green-600 text-white" : "border-gray-300 bg-white"
                  )}
                >
                  {isOn && <Check className="h-3 w-3" />}
                </span>
                <span className="font-medium">
                  {c.arabizi}
                  {c.script && (
                    <span dir="rtl" className="mx-1.5 font-normal">
                      {c.script}
                    </span>
                  )}
                </span>
                <span className="ml-auto text-subtle">{c.english}</span>
              </button>
            );
          })}
        </div>
        <Button
          disabled={selected.size === 0}
          onClick={() => {
            setJustConfirmed(true);
            onStartWords([...selected]);
          }}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          Learn {selected.size === widget.candidates.length ? "all" : selected.size} of these
        </Button>
      </CardContent>
    </Card>
  );
}
