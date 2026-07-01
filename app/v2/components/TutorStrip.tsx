/* eslint-disable @next/next/no-img-element */
import { MarkdownContent } from "./MarkdownContent";

// The tutor's voice in the active view: a compact strip under the card
// (pomegranate avatar + short comment), instead of free-floating paragraphs.
export function TutorStrip({ text }: { text: string }) {
  return (
    <div className="w-full max-w-md mx-auto flex items-start gap-2.5 rounded-2xl bg-red-50/60 border border-red-100 px-4 py-3">
      <img src="/logo.svg" alt="" className="w-6 h-6 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <MarkdownContent text={text} />
      </div>
    </div>
  );
}
