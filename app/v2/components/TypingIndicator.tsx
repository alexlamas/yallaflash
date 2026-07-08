/* eslint-disable @next/next/no-img-element */

// The tutor's "typing" presence: avatar + three staggered dots, replacing a
// bare mono THINKING... string. `label` distinguishes grading ("Checking
// your answer") from ordinary tutor thinking.
export function TypingIndicator({ label }: { label?: string }) {
  return (
    // Left-anchored like TutorStrip so the avatar sits exactly where the
    // tutor's next bubble will land -- centered, it floated between the
    // bubble column and the cards and lined up with neither.
    <div className="w-full max-w-lg flex items-center gap-2.5" aria-live="polite">
      <img src="/logo.svg" alt="" className="w-6 h-6 shrink-0" />
      <div className="flex items-center gap-2 rounded-2xl bg-white border border-gray-200 shadow-sm px-3.5 py-2.5">
        <span className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-gray-400 motion-safe:animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
            />
          ))}
        </span>
        {label && <span className="text-xs text-subtle">{label}</span>}
      </div>
    </div>
  );
}
