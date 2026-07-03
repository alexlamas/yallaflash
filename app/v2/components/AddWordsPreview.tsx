"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Widget, WordProposal } from "@/app/v2/lib/types";

export function AddWordsPreview({
  widget,
  onConfirm,
  answered = false,
}: {
  widget: Extract<Widget, { type: "add_words_preview" }>;
  onConfirm: (proposals: WordProposal[]) => void;
  // Durable confirmed state from the conversation -- local state alone
  // resets on remount and left a live "Confirm and add" button behind.
  answered?: boolean;
}) {
  const [justConfirmed, setJustConfirmed] = useState(false);
  const confirmed = answered || justConfirmed;
  const count = widget.proposals.length;

  // Belt-and-suspenders against an empty staging call reaching the UI.
  if (count === 0) return null;

  // Once confirmed, the call-to-action collapses to a receipt styled as a
  // miniature of the /words table, with a jump link to the full thing.
  if (confirmed) {
    return (
      <div className="max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-green-50/60 px-3.5 py-2 text-sm">
          <Check className="h-4 w-4 text-green-700" />
          <span className="font-semibold text-green-900">
            Added {count} word{count === 1 ? "" : "s"}
          </span>
          <Link
            href="/words"
            className="ml-auto flex items-center gap-0.5 text-xs font-medium text-subtle hover:text-heading"
          >
            My words <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            {widget.proposals.map((p, i) => (
              <tr key={i} className="border-t border-gray-50 first:border-t-0">
                <td className="px-3.5 py-1.5 font-medium">{p.arabizi}</td>
                <td dir="rtl" className="px-2 py-1.5">
                  {p.script ?? ""}
                </td>
                <td className="px-2 py-1.5 text-subtle">{p.english}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const handleConfirm = () => {
    setJustConfirmed(true);
    onConfirm(widget.proposals);
  };

  return (
    <Card className="max-w-md">
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">{count} word{count === 1 ? "" : "s"} to add</div>
        <div className="space-y-2">
          {widget.proposals.map((p, i) => (
            <div key={i} className="text-sm border-b pb-2 last:border-b-0">
              <div className="font-medium">
                {p.arabizi} {p.script && <span dir="rtl" className="mx-1">{p.script}</span>}
                <span className="text-subtle">-- {p.english}</span>
              </div>
              {p.type && <div className="text-xs text-subtle">{p.type}</div>}
              {p.flagged_assumptions?.map((flag, j) => (
                <div key={j} className="text-xs text-amber-700">
                  Not sure about {flag.field}: {Object.entries(flag.options).map(([k, v]) => `${k}) ${v}`).join("  ")}
                </div>
              ))}
            </div>
          ))}
        </div>
        <Button onClick={handleConfirm} className="w-full">
          Confirm and add
        </Button>
      </CardContent>
    </Card>
  );
}
