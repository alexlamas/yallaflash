"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OnboardingChoice({
  onChoose,
}: {
  onChoose: (choice: "add_words" | "browse_packs") => void;
}) {
  const [choice, setChoice] = useState<"add_words" | "browse_packs" | null>(null);

  const handleChoose = (value: "add_words" | "browse_packs") => {
    if (choice) return;
    setChoice(value);
    onChoose(value);
  };

  return (
    <Card className="max-w-sm">
      <CardContent className="p-4 flex gap-2">
        <Button
          variant="outline"
          disabled={choice !== null}
          onClick={() => handleChoose("add_words")}
          className={cn(
            "flex-1 hover:border-green-400 hover:bg-green-50/50",
            choice === "add_words" && "bg-green-600 border-green-600 text-white hover:bg-green-600"
          )}
        >
          Add words
        </Button>
        <Button
          variant="outline"
          disabled={choice !== null}
          onClick={() => handleChoose("browse_packs")}
          className={cn(
            "flex-1 hover:border-green-400 hover:bg-green-50/50",
            choice === "browse_packs" && "bg-green-600 border-green-600 text-white hover:bg-green-600"
          )}
        >
          Browse packs
        </Button>
      </CardContent>
    </Card>
  );
}
