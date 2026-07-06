import posthog from "posthog-js";

// Thin wrapper over posthog-js for v2 events. PostHogProvider initializes
// the client app-wide; this guards the capture so environments without a
// key (local dev, tests) stay silent instead of warning.
//
// v2 event vocabulary (keep this list in sync with docs/PRODUCT_LOOP.md):
//   v2_hero_cta_clicked   { action: start_review | learn_new | review_ahead | add_words, due }
//   v2_message_sent       { with_image }
//   v2_word_reviewed      { tier, correct, hinted, conceded, method: instant | checked }
//   v2_session_completed  { reviewed, correct }
//   v2_session_rated      { rating: up | down, reviewed, correct }
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}
