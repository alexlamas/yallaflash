"use client";

// Throwaway visual check for ReviewVerdict styling -- not linked anywhere,
// deleted after screenshotting.
import { ReviewVerdict } from "@/app/v2/components/ReviewVerdict";

export default function DevVerdictCheck() {
  const inTen = new Date(Date.now() + 10 * 60000).toISOString();
  return (
    <div className="max-w-xl mx-auto py-10 space-y-6 bg-[#fdfcf8] min-h-screen">
      <ReviewVerdict
        widget={{
          type: "review_verdict",
          correct: false,
          arabizi: "ana bjamme3",
          english: "I collect",
          script: null,
          next_review_date: inTen,
        }}
      />
      <ReviewVerdict
        widget={{
          type: "review_verdict",
          correct: true,
          arabizi: "l leyle",
          english: "tonight",
          script: "الليلة",
          next_review_date: new Date(Date.now() + 3 * 86400000).toISOString(),
        }}
      />
      <ReviewVerdict
        widget={{
          type: "review_verdict",
          correct: true,
          save_failed: true,
          arabizi: "natr",
          english: "waiting",
          script: null,
          next_review_date: "",
        }}
      />
    </div>
  );
}
