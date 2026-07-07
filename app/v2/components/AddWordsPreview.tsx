"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE } from "@/app/v2/lib/language";
import type { Widget, WordProposal } from "@/app/v2/lib/types";

export function AddWordsPreview({
  widget,
  onConfirm,
  onDismiss,
  answered = false,
}: {
  widget: Extract<Widget, { type: "add_words_preview" }>;
  onConfirm: (proposals: WordProposal[]) => Promise<boolean>;
  onDismiss: () => void;
  // Durable confirmed state from the conversation -- local state alone
  // resets on remount and left a live "Confirm and add" button behind.
  answered?: boolean;
}) {
  // Local copy so flagged-assumption picks can patch fields before confirm.
  const [proposals, setProposals] = useState(widget.proposals);
  // Which option the user picked per flag, keyed `${proposalIndex}:${field}`.
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const confirmed = answered || justConfirmed;
  const count = proposals.length;

  // Belt-and-suspenders against an empty staging call reaching the UI.
  if (count === 0) return null;

  if (dismissed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-subtle">
        Skipped these words
      </div>
    );
  }

  // Once confirmed, the call-to-action collapses to a receipt styled as a
  // miniature of the /words table, with a jump link to the full thing.
  if (confirmed) {
    return (
      <div className="max-w-md overflow-hidden rounded-2xl border-[0.5px] border-gray-200 bg-white shadow-sm">
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
            {proposals.map((p, i) => (
              <tr key={i} className="border-t border-gray-50 first:border-t-0">
                <td className="px-3.5 py-1.5 font-medium">{p.arabizi}</td>
                <td dir={DEFAULT_LANGUAGE.scriptDir} className="px-2 py-1.5">
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

  // Applying a flagged option patches the proposal itself, so the confirm
  // ingests the user's pick, not the model's guess.
  const pickOption = (proposalIndex: number, field: string, value: string) => {
    setPicks((prev) => ({ ...prev, [`${proposalIndex}:${field}`]: value }));
    setProposals((prev) =>
      prev.map((p, i) => (i === proposalIndex ? ({ ...p, [field]: value } as WordProposal) : p))
    );
  };

  // The receipt flips only after the save lands -- a failed write keeps the
  // preview interactive instead of leaving a false "Added" receipt behind.
  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onConfirm(proposals);
    setSaving(false);
    if (ok) setJustConfirmed(true);
  };

  return (
    <Card className="max-w-md">
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">{count} word{count === 1 ? "" : "s"} to add</div>
        <div className="space-y-2">
          {proposals.map((p, i) => (
            <div key={i} className="text-sm border-b pb-2 last:border-b-0">
              <div className="font-medium">
                {p.arabizi}{" "}
                {p.script && (
                  <span dir={DEFAULT_LANGUAGE.scriptDir} className="mx-1">
                    {p.script}
                  </span>
                )}
                <span className="text-subtle">— {p.english}</span>
              </div>
              {p.type && <div className="text-xs text-subtle">{p.type}</div>}
              {p.flagged_assumptions?.map((flag, j) => {
                const picked = picks[`${i}:${flag.field}`];
                return (
                  <div key={j} className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-amber-700">
                    <span>Not sure about {flag.field}:</span>
                    {Object.values(flag.options).map((option) => (
                      <button
                        key={option}
                        onClick={() => pickOption(i, flag.field, option)}
                        aria-pressed={picked === option}
                        className={cn(
                          "rounded-full border px-2 py-0.5 transition-colors",
                          picked === option
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-amber-300 bg-amber-50/60 hover:border-amber-400"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setDismissed(true);
              onDismiss();
            }}
            className="text-subtle"
          >
            No thanks
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {saving ? "Adding..." : "Confirm and add"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
