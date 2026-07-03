"use client";

import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// The user-editable slice of the tutor's behavior, surfaced at onboarding.
// Saving writes v2_user_settings; the tutor reads it on every turn and can
// also rewrite it mid-conversation (update_instructions).
export function InstructionsEditor({ initial }: { initial: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      const res = await fetch("/api/v2/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: value }),
      });
      if (!res.ok) throw new Error("Couldn't save -- try again.");
      setSaved(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save -- try again.");
    }
  }

  if (saved) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50/70 px-4 py-2 text-sm text-green-900">
        <Check className="h-4 w-4 text-green-700" />
        Coaching style saved -- change it anytime by just asking
      </div>
    );
  }

  return (
    <div className="max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-gray-50"
      >
        <SlidersHorizontal className="h-4 w-4 text-green-700" />
        <span className="font-medium">How I&apos;ll coach you</span>
        <span className="ml-auto text-xs text-subtle">{open ? "collapse" : "view & edit"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-gray-100 p-3.5">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            className="text-sm"
          />
          <p className="text-xs text-subtle">
            These are standing instructions the tutor follows -- edit them here, or later just tell it
            things like &quot;skip the root explanations&quot;.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button onClick={save} disabled={!value.trim()} className="w-full bg-green-600 hover:bg-green-700">
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
