"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Widget } from "@/app/v2/lib/types";

export function PackList({
  widget,
  onStartPack,
  onDismiss,
  answered = false,
}: {
  widget: Extract<Widget, { type: "pack_list" }>;
  onStartPack: (packId: string) => Promise<boolean>;
  onDismiss: () => void;
  // Durable answered state -- a reloaded pack list must not come back with
  // live Start buttons after a pack was already started.
  answered?: boolean;
}) {
  const [startedId, setStartedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const done = answered || startedId !== null;

  if (dismissed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-subtle">
        Maybe later
      </div>
    );
  }

  // "Started" flips only after the write lands -- a failed start keeps the
  // button live instead of showing a false receipt.
  const handleStart = async (packId: string) => {
    if (done || savingId) return;
    setSavingId(packId);
    const ok = await onStartPack(packId);
    setSavingId(null);
    if (ok) setStartedId(packId);
  };

  return (
    <Card className="max-w-sm">
      <CardContent className="p-4 space-y-2">
        {widget.packs.map((pack) => (
          <div key={pack.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0">
            <div>
              <div className="text-sm font-medium">{pack.name}</div>
              {pack.description && <div className="text-xs text-subtle">{pack.description}</div>}
            </div>
            {startedId === pack.id ? (
              // A confirmation, not a disabled control -- disabled styling
              // washes it out to a broken-looking half-transparent button.
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50/70 px-3 py-1.5 text-xs font-medium text-green-900">
                <Check className="h-3.5 w-3.5 text-green-700" /> Started
              </span>
            ) : (
              <Button
                size="sm"
                disabled={done || savingId !== null}
                onClick={() => handleStart(pack.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                {savingId === pack.id ? "Starting..." : "Start"}
              </Button>
            )}
          </div>
        ))}
        {!done && (
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="w-full pt-1 text-center text-xs text-subtle hover:text-heading transition-colors"
          >
            No thanks
          </button>
        )}
      </CardContent>
    </Card>
  );
}
