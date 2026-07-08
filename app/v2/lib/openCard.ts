// The open card and its leak guards, shared by the chat route and tested
// against buildServedLine's real output -- the parser once silently died
// when the served line grew a `level=` token, which turned off every guard
// (the tutor started naming answers while cards were still up).

// The word on the table: the most recent [SERVED] card with no later
// [REVIEW RESULT] for the same word. Also parses which side the card shows
// and which it hides, so the reply text can be scrubbed of the answer.
export type OpenCard = { wordId: string; shown: string; hidden: string };

export function findOpenCard(rows: { role: string; content: string }[]): OpenCard | null {
  const answered = new Set<string>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const content = rows[i].content;
    if (content.startsWith("[REVIEW RESULT]")) {
      const match = content.match(/word_id=(\S+)/);
      if (match) answered.add(match[1]);
    } else if (content.startsWith("[SERVED]")) {
      // Tolerate tokens between english and tier (level= today) -- new
      // tokens have crept in before and MUST NOT kill the parse: a null
      // here disables the answer scrub entirely.
      const match = content.match(/word_id=(\S+) arabizi="([^"]*)" english="([^"]*)".*? tier=(\S+)/);
      if (!match) return null;
      const [, wordId, arabizi, english, tier] = match;
      if (answered.has(wordId)) return null;
      // The asks= token says which side the card hides (formats vary within
      // a tier now -- reversed multiple choice hides the word on the easy
      // tier). Older persisted lines lack it; fall back to the tier rule.
      const asksMatch = content.match(/asks=(arabizi|english)/);
      const hidesWord = asksMatch ? asksMatch[1] === "arabizi" : tier === "hard";
      return hidesWord
        ? { wordId, shown: english, hidden: arabizi }
        : { wordId, shown: arabizi, hidden: english };
    }
  }
  return null;
}

// Replace any mention of the open card's hidden side with its shown side, so
// "the 'l leyle' card is still waiting" becomes "the 'tonight' card is still
// waiting". Consumes wrapping quotes to avoid doubling them.
export function scrubOpenCardAnswer(text: string, card: OpenCard): string {
  if (!card.hidden.trim()) return text;
  const escaped = card.hidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`["'‘’“”]?\\b${escaped}\\b["'‘’“”]?`, "gi");
  return text.replace(pattern, `"${card.shown}"`);
}

// Streaming-safe view of in-flight text: scrub completed mentions of the open
// card's hidden side, and hold back any trailing PARTIAL match so the answer
// can't flash on screen for a frame before the scrub catches it. Because
// events are full-replace snapshots, held-back text is emitted (or scrubbed)
// by a later snapshot -- nothing is lost.
export function streamSafeText(text: string, card: OpenCard | null): string {
  if (!card || !card.hidden.trim()) return text;
  const lower = text.toLowerCase();
  const hidden = card.hidden.toLowerCase();
  let cut = text.length;
  for (let k = Math.min(hidden.length - 1, lower.length); k > 0; k--) {
    if (lower.endsWith(hidden.slice(0, k))) {
      cut = text.length - k;
      break;
    }
  }
  return scrubOpenCardAnswer(text.slice(0, cut), card);
}
