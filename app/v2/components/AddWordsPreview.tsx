"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Widget, WordProposal } from "@/app/v2/lib/types";

export function AddWordsPreview({
  widget,
  onConfirm,
}: {
  widget: Extract<Widget, { type: "add_words_preview" }>;
  onConfirm: (proposals: WordProposal[]) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (confirmed) return;
    setConfirmed(true);
    onConfirm(widget.proposals);
  };

  return (
    <Card className="max-w-md">
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">{widget.proposals.length} word{widget.proposals.length === 1 ? "" : "s"} to add</div>
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
        <Button disabled={confirmed} onClick={handleConfirm} className="w-full">
          {confirmed ? "Added" : "Confirm and add"}
        </Button>
      </CardContent>
    </Card>
  );
}
