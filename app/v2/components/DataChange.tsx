import Link from "next/link";
import { ArrowUpRight, CalendarClock, Check, Pencil, StickyNote, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Widget } from "@/app/v2/lib/types";

// Receipt for a tutor-initiated data change, styled as a miniature of the
// /words table (same mono headers, same row language) with a jump link to
// the full thing. Mutations are visible as data, not just claimed in prose.

const ACTION_META = {
  regraded: { label: "Regraded", Icon: Check },
  rescheduled: { label: "Rescheduled", Icon: CalendarClock },
  edited: { label: "Edited", Icon: Pencil },
  deleted: { label: "Removed", Icon: Trash2 },
  note_saved: { label: "Note saved", Icon: StickyNote },
} as const;

export function DataChange({ widget }: { widget: Extract<Widget, { type: "data_change" }> }) {
  const meta = ACTION_META[widget.action];
  const destructive = widget.action === "deleted";
  return (
    <div className="max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-gray-100 px-3.5 py-2 text-sm",
          destructive ? "bg-red-50/60" : "bg-green-50/60"
        )}
      >
        <meta.Icon className={cn("h-4 w-4", destructive ? "text-red-600" : "text-green-700")} />
        <span className={cn("font-semibold", destructive ? "text-red-700" : "text-green-900")}>
          {meta.label}
        </span>
        <span className="font-medium text-heading">{widget.arabizi}</span>
        <Link
          href="/words"
          className="ml-auto flex items-center gap-0.5 text-xs font-medium text-subtle hover:text-heading"
        >
          My words <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      {widget.changes.length > 0 && (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-subtle">
              <th className="px-3.5 py-1.5 font-medium">Field</th>
              <th className="px-2 py-1.5 font-medium">Before</th>
              <th className="px-2 py-1.5 font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {widget.changes.map((change, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-subtle">
                  {change.field}
                </td>
                <td className="px-2 py-1.5 text-subtle">
                  {change.from != null ? <span className="line-through decoration-red-300">{change.from}</span> : "--"}
                </td>
                <td className="px-2 py-1.5 font-medium text-heading">{change.to ?? "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
