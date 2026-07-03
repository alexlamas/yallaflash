import { Card, CardContent } from "@/components/ui/card";
import type { Widget } from "@/app/v2/lib/types";

export function SessionSummary({ widget }: { widget: Extract<Widget, { type: "session_summary" }> }) {
  return (
    <Card className="max-w-sm">
      <CardContent className="p-4">
        <div className="text-sm font-medium">
          Reviewed {widget.reviewed} word{widget.reviewed === 1 ? "" : "s"}, got {widget.correct} right
        </div>
      </CardContent>
    </Card>
  );
}
