/* eslint-disable @next/next/no-img-element */
import { Card, CardContent } from "@/components/ui/card";
import type { Widget } from "@/app/v2/lib/types";

type WordCardWidget = Extract<Widget, { type: "word_card" }>;

export function WordCard({
  word,
  imageUrl,
  active = false,
}: {
  word: WordCardWidget["word"];
  imageUrl?: string | null;
  active?: boolean;
}) {
  return (
    <Card
      className={
        active
          ? "w-full max-w-md mx-auto bg-red-50/40 border-red-100 overflow-hidden rounded-3xl shadow-lg"
          : "max-w-sm bg-red-50/40 border-red-100 overflow-hidden"
      }
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={word.english}
          className={active ? "w-full h-44 object-cover" : "w-full h-36 object-cover"}
        />
      )}
      <CardContent className={active ? "p-7 space-y-1 text-center" : "p-4 space-y-1"}>
        {word.script && (
          <div className={active ? "text-4xl" : "text-2xl"} dir="rtl">
            {word.script}
          </div>
        )}
        <div className={active ? "text-3xl font-title" : "text-lg font-medium"}>{word.arabizi}</div>
        <div className="text-sm text-muted-foreground">{word.english}</div>
        {word.memory_hook && (
          <div className="text-xs text-subtle pt-1 border-t mt-2">{word.memory_hook}</div>
        )}
      </CardContent>
    </Card>
  );
}
