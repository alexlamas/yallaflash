import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Widget } from "@/app/v2/lib/types";

export function ReviewVerdict({ widget }: { widget: Extract<Widget, { type: "review_verdict" }> }) {
  return (
    <Card className={cn("max-w-sm", widget.correct ? "bg-green-50/40 border-green-100" : "bg-red-50/40 border-red-100")}>
      <CardContent className="p-4 space-y-1">
        <div className="text-sm font-medium">{widget.correct ? "Correct" : "Not quite"}</div>
        {widget.script && <div className="text-2xl" dir="rtl">{widget.script}</div>}
        {widget.etymology_note && (
          <div className="text-xs text-subtle pt-1 border-t mt-2">
            {widget.etymology_confidence === "uncertain" && (
              <span className="font-medium">Not certain -- </span>
            )}
            {widget.etymology_note}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
