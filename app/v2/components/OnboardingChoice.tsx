"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
          variant={choice === "add_words" ? "default" : "outline"}
          disabled={choice !== null}
          onClick={() => handleChoose("add_words")}
          className="flex-1"
        >
          Add words
        </Button>
        <Button
          variant={choice === "browse_packs" ? "default" : "outline"}
          disabled={choice !== null}
          onClick={() => handleChoose("browse_packs")}
          className="flex-1"
        >
          Browse packs
        </Button>
      </CardContent>
    </Card>
  );
}
