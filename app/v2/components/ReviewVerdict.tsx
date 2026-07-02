import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Widget } from "@/app/v2/lib/types";

function relativeTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `~${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `~${hours}h`;
  return `~${Math.round(hours / 24)}d`;
}

export function ReviewVerdict({ widget }: { widget: Extract<Widget, { type: "review_verdict" }> }) {
  const heading = widget.conceded ? "Answer revealed" : widget.correct ? "Correct" : "Not quite";
  return (
    <Card
      className={cn(
        "w-full max-w-md mx-auto rounded-2xl",
        widget.correct ? "bg-green-50/70 border-green-200" : "bg-red-50/60 border-red-200"
      )}
    >
      <CardContent className="p-5 text-center space-y-1.5">
        <div
          className={cn(
            "text-xs font-semibold tracking-wide uppercase",
            widget.correct ? "text-green-700" : "text-red-600"
          )}
        >
          {heading}
        </div>
        {widget.script && (
          <div className="text-3xl" dir="rtl">
            {widget.script}
          </div>
        )}
        <div className="text-lg font-medium text-heading">
          {widget.arabizi} <span className="text-subtle font-normal">— {widget.english}</span>
        </div>
        {!widget.correct && !widget.conceded && widget.submitted && (
          <div className="text-xs text-subtle">You said: {widget.submitted}</div>
        )}
        <div className="text-[11px] font-mono text-disabled pt-1">
          {/* Instant verdicts render before the schedule write returns;
              the real date is patched in a moment later. */}
          next review {widget.next_review_date ? relativeTime(widget.next_review_date) : "..."}
        </div>
      </CardContent>
    </Card>
  );
}
