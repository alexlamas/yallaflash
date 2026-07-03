"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Widget } from "@/app/v2/lib/types";

export function PackList({
  widget,
  onStartPack,
}: {
  widget: Extract<Widget, { type: "pack_list" }>;
  onStartPack: (packId: string) => void;
}) {
  const [startedId, setStartedId] = useState<string | null>(null);

  const handleStart = (packId: string) => {
    if (startedId) return;
    setStartedId(packId);
    onStartPack(packId);
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
            <Button
              size="sm"
              disabled={startedId !== null}
              onClick={() => handleStart(pack.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              {startedId === pack.id ? "Started" : "Start"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
