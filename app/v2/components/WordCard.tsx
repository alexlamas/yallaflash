import { Card, CardContent } from "@/components/ui/card";
import type { Widget } from "@/app/v2/lib/types";

export function WordCard({ word }: { word: Extract<Widget, { type: "word_card" }>["word"] }) {
  return (
    <Card className="max-w-sm bg-red-50/40 border-red-100">
      <CardContent className="p-4 space-y-1">
        {word.script && <div className="text-2xl" dir="rtl">{word.script}</div>}
        <div className="text-lg font-medium">{word.arabizi}</div>
        <div className="text-sm text-muted-foreground">{word.english}</div>
        {word.memory_hook && (
          <div className="text-xs text-subtle pt-1 border-t mt-2">{word.memory_hook}</div>
        )}
      </CardContent>
    </Card>
  );
}
