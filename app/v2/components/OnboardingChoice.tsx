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
        {/* The chosen state is aria-disabled, not disabled: the disabled
            style's 50% opacity makes the confirmed choice look broken. */}
        <Button
          variant="outline"
          aria-disabled={choice !== null}
          aria-pressed={choice === "add_words"}
          onClick={() => handleChoose("add_words")}
          className={cn(
            "flex-1",
            choice === null && "hover:border-green-400 hover:bg-green-50/50",
            choice === "add_words" &&
              "bg-green-600 border-green-600 text-white hover:bg-green-600 hover:text-white",
            choice === "browse_packs" && "opacity-60"
          )}
        >
          Add words
        </Button>
        <Button
          variant="outline"
          aria-disabled={choice !== null}
          aria-pressed={choice === "browse_packs"}
          onClick={() => handleChoose("browse_packs")}
          className={cn(
            "flex-1",
            choice === null && "hover:border-green-400 hover:bg-green-50/50",
            choice === "browse_packs" &&
              "bg-green-600 border-green-600 text-white hover:bg-green-600 hover:text-white",
            choice === "add_words" && "opacity-60"
          )}
        >
          Browse packs
        </Button>
      </CardContent>
    </Card>
  );
}
