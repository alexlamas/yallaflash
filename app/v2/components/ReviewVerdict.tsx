"use client";

import { Check, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();
  const heading = widget.conceded
    ? "Answer revealed"
    : widget.correct
    ? widget.hinted
      ? "Correct — with a hint"
      : "Correct"
    : "Not quite";
  const Icon = widget.correct ? Check : X;
  return (
    <Card
      className={cn(
        "w-full max-w-md mx-auto rounded-2xl",
        widget.correct ? "bg-green-50/70 border-green-200" : "bg-red-50/60 border-red-200"
      )}
    >
      <CardContent className="p-5 text-center space-y-2">
        {/* The verdict moment: icon springs in, label sits beside it. Small on
            purpose -- the word below is what should stick, not the grade. */}
        <div
          className={cn(
            "flex items-center justify-center gap-1.5",
            widget.correct ? "text-green-700" : "text-red-600"
          )}
        >
          <motion.span
            initial={reduceMotion ? false : { scale: 0.25, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              widget.correct ? "bg-green-600" : "bg-red-500"
            )}
          >
            <Icon className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden="true" />
          </motion.span>
          <span className="text-sm font-semibold">{heading}</span>
        </div>
        {widget.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={widget.image_url}
            alt=""
            className="h-20 w-20 rounded-xl object-cover mx-auto outline outline-1 -outline-offset-1 outline-black/10"
          />
        )}
        {widget.script && (
          <div className="text-3xl" dir="rtl">
            {widget.script}
          </div>
        )}
        <div className="text-lg font-medium text-heading">
          {widget.arabizi} <span className="text-subtle font-normal">— {widget.english}</span>
        </div>
        {!widget.correct && !widget.conceded && widget.submitted && (
          <div className="text-xs text-subtle">
            You said <span className="line-through decoration-red-300 decoration-1">{widget.submitted}</span>
          </div>
        )}
        {/* Quiet sentence-case footnote. Instant verdicts render before the
            schedule write returns; the real date is patched in a moment later
            (tabular-nums keeps the swap from shifting) -- or flagged plainly
            if the write died. */}
        {widget.save_failed ? (
          <div className="pt-1 text-xs text-red-600">
            Couldn&apos;t save — this word will come up again
          </div>
        ) : (
          <div className="pt-1 text-xs text-subtle tabular-nums">
            Next review {widget.next_review_date ? relativeTime(widget.next_review_date) : "..."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
