/* eslint-disable @next/next/no-img-element */
import { MarkdownContent } from "./MarkdownContent";

// The tutor's voice: a left-anchored chat bubble (avatar outside, soft
// neutral fill, no border) -- it should read as a message, not an info
// notice.
export function TutorStrip({ text }: { text: string }) {
  return (
    <div className="w-full max-w-lg flex items-start gap-2.5">
      <img src="/logo.svg" alt="" className="w-6 h-6 shrink-0 mt-1.5" />
      <div className="min-w-0 rounded-2xl rounded-tl-md bg-stone-100/80 px-4 py-2.5 text-[15px] leading-relaxed text-stone-800">
        <MarkdownContent text={text} />
      </div>
    </div>
  );
}
