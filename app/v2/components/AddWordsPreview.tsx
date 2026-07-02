"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Widget, WordProposal } from "@/app/v2/lib/types";

export function AddWordsPreview({
  widget,
  onConfirm,
  answered = false,
}: {
  widget: Extract<Widget, { type: "add_words_preview" }>;
  onConfirm: (proposals: WordProposal[]) => void;
  // Durable confirmed state from the conversation -- local state alone
  // resets on remount and left a live "Confirm and add" button behind.
  answered?: boolean;
}) {
  const [justConfirmed, setJustConfirmed] = useState(false);
  const confirmed = answered || justConfirmed;
  const count = widget.proposals.length;

  // Belt-and-suspenders against an empty staging call reaching the UI.
  if (count === 0) return null;

  // Once confirmed, the call-to-action collapses to a receipt.
  if (confirmed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50/70 px-4 py-2 text-sm text-green-900">
        <Check className="h-4 w-4 text-green-700" />
        Added {count} word{count === 1 ? "" : "s"}
      </div>
    );
  }

  const handleConfirm = () => {
    setJustConfirmed(true);
    onConfirm(widget.proposals);
  };

  return (
    <Card className="max-w-md">
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">{count} word{count === 1 ? "" : "s"} to add</div>
        <div className="space-y-2">
          {widget.proposals.map((p, i) => (
            <div key={i} className="text-sm border-b pb-2 last:border-b-0">
              <div className="font-medium">
                {p.arabizi} {p.script && <span dir="rtl" className="mx-1">{p.script}</span>}
                <span className="text-subtle">-- {p.english}</span>
              </div>
              {p.type && <div className="text-xs text-subtle">{p.type}</div>}
              {p.flagged_assumptions?.map((flag, j) => (
                <div key={j} className="text-xs text-amber-700">
                  Not sure about {flag.field}: {Object.entries(flag.options).map(([k, v]) => `${k}) ${v}`).join("  ")}
                </div>
              ))}
            </div>
          ))}
        </div>
        <Button onClick={handleConfirm} className="w-full">
          Confirm and add
        </Button>
      </CardContent>
    </Card>
  );
}
