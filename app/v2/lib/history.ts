import type { V2Message } from "./types";

// Synthetic ground-truth messages fed back into the model after a
// widget-driven mutation (see tutorPrompt.ts) -- shown to the tutor, not the
// user.
export const HIDDEN_PREFIXES = ["[REVIEW RESULT]", "[WORDS CONFIRMED]", "[PACK STARTED]", "[SERVED]"];

// Late background commentary (a hidden ground-truth row plus the tutor's
// reply to it) persists AFTER the next card's rows -- the reply only lands
// once the card is already on the table. Rendering the stored order verbatim
// therefore puts commentary about the PREVIOUS word underneath the open
// card, where it reads as a reply to the card on stage. The live session
// splices such replies above the card as they arrive (see ChatWindow's
// sendMessage race guard); this applies the same order to a loaded
// transcript. The user's own mid-card exchange -- visible user rows (hints,
// questions) and the replies that follow them -- stays with the card.
export function liftStaleCommentary(messages: V2Message[], openCardMessageId: string): V2Message[] {
  const cardIndex = messages.findIndex((m) => m.id === openCardMessageId);
  if (cardIndex === -1 || cardIndex === messages.length - 1) return messages;

  const stale: V2Message[] = [];
  const exchange: V2Message[] = [];
  let inStale = false;
  for (const message of messages.slice(cardIndex + 1)) {
    if (message.role === "user") {
      inStale = HIDDEN_PREFIXES.some((prefix) => message.content.startsWith(prefix));
    }
    (inStale ? stale : exchange).push(message);
  }
  if (stale.length === 0) return messages;
  return [...messages.slice(0, cardIndex), ...stale, messages[cardIndex], ...exchange];
}
