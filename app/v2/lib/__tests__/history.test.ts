import { describe, expect, it } from "vitest";
import { liftStaleCommentary } from "../history";
import type { V2Message } from "../types";

function msg(id: string, role: "user" | "assistant", content: string): V2Message {
  return { id, conversation_id: "c", role, content, widgets: [], created_at: "" };
}

// The persisted transcript: card B was served, then the tutor's late
// commentary about word A (already answered) landed AFTER it -- exactly the
// order that made "That's 'I burn / get burned'..." render under an
// unrelated card on reload.
describe("liftStaleCommentary", () => {
  it("moves hidden-result commentary above the open card", () => {
    const messages = [
      msg("served-b", "user", '[SERVED] word_id=b arabizi="x" english="y" level=0 tier=easy'),
      msg("card-b", "assistant", ""),
      msg("result-a", "user", "[REVIEW RESULT] word_id=a correct=false"),
      msg("commentary-a", "assistant", "That's 'I burn / get burned'..."),
    ];
    const ordered = liftStaleCommentary(messages, "card-b");
    expect(ordered.map((m) => m.id)).toEqual(["served-b", "result-a", "commentary-a", "card-b"]);
  });

  it("keeps the user's own mid-card exchange below the card", () => {
    const messages = [
      msg("card-b", "assistant", ""),
      msg("hint-q", "user", "give me a hint"),
      msg("hint-a", "assistant", "Think of fire..."),
    ];
    const ordered = liftStaleCommentary(messages, "card-b");
    expect(ordered.map((m) => m.id)).toEqual(["card-b", "hint-q", "hint-a"]);
  });

  it("separates stale commentary from the live exchange when both follow", () => {
    const messages = [
      msg("card-b", "assistant", ""),
      msg("result-a", "user", "[REVIEW RESULT] word_id=a correct=true"),
      msg("commentary-a", "assistant", "Good."),
      msg("question", "user", "what's the root?"),
      msg("answer", "assistant", "h-d-f..."),
    ];
    const ordered = liftStaleCommentary(messages, "card-b");
    expect(ordered.map((m) => m.id)).toEqual(["result-a", "commentary-a", "card-b", "question", "answer"]);
  });

  it("leaves transcripts without trailing rows untouched", () => {
    const messages = [msg("a", "assistant", "hi"), msg("card", "assistant", "")];
    expect(liftStaleCommentary(messages, "card")).toBe(messages);
  });
});
