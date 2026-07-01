/* eslint-disable @next/next/no-img-element */
import { Card, CardContent } from "@/components/ui/card";
import type { Widget } from "@/app/v2/lib/types";

type WordCardWidget = Extract<Widget, { type: "word_card" }>;

export function WordCard({
  word,
  imageUrl,
}: {
  word: WordCardWidget["word"];
  imageUrl?: string | null;
}) {
  return (
    <Card className="max-w-sm bg-red-50/40 border-red-100 overflow-hidden">
      {imageUrl && (
        <img src={imageUrl} alt={word.english} className="w-full h-36 object-cover" />
      )}
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
