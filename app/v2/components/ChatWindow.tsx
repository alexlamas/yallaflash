"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WidgetRenderer, type WidgetActions } from "./WidgetRenderer";
import type { ReviewTier, V2Message, Widget, WordProposal } from "@/app/v2/lib/types";

const STORAGE_KEY = "yallaflash_v2_conversation_id";

// Synthetic ground-truth messages fed back into the model after a
// widget-driven mutation (see tutorPrompt.ts) -- shown to the tutor, not the user.
const HIDDEN_PREFIXES = ["[REVIEW RESULT]", "[WORDS CONFIRMED]", "[PACK STARTED]"];

let localIdCounter = 0;
function nextLocalId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

export function ChatWindow() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState("Ask your tutor anything...");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      loadHistory(stored);
    } else {
      bootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory(id: string) {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("v2_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error || !data || data.length === 0) {
      await bootstrap();
      return;
    }
    setConversationId(id);
    setMessages(data as V2Message[]);
    setLoading(false);
  }

  async function bootstrap() {
    setLoading(true);
    const res = await fetch("/api/v2/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    window.localStorage.setItem(STORAGE_KEY, data.conversationId);
    setConversationId(data.conversationId);
    setMessages([data.message]);
    setLoading(false);
  }

  function appendLocalMessage(content: string, widgets: Widget[] = []) {
    setMessages((prev) => [
      ...prev,
      {
        id: nextLocalId(),
        conversation_id: conversationId ?? "",
        role: "assistant",
        content,
        widgets,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        id: nextLocalId(),
        conversation_id: conversationId ?? "",
        role: "user",
        content: text,
        widgets: [],
        created_at: new Date().toISOString(),
      },
    ]);

    const res = await fetch("/api/v2/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message: text }),
    });
    const data = await res.json();
    setConversationId(data.conversationId);
    setMessages((prev) => [...prev, data.message]);
    setLoading(false);
  }

  function handleSubmit() {
    const text = input;
    setInput("");
    sendMessage(text);
  }

  const actions: WidgetActions = {
    onAnswer: async (wordId: string, tier: ReviewTier, submitted: string) => {
      setLoading(true);
      const res = await fetch("/api/v2/review/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, tier, submitted }),
      });
      const result = await res.json();
      await sendMessage(
        `[REVIEW RESULT] word_id=${wordId} submitted="${submitted}" correct=${result.correct} arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`
      );
    },
    onConfirmWords: async (proposals: WordProposal[]) => {
      setLoading(true);
      const res = await fetch("/api/v2/words/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposals }),
      });
      const result = await res.json();
      const summary = (result.words ?? [])
        .map((w: { arabizi: string; english: string }) => `${w.arabizi} = ${w.english}`)
        .join(", ");
      await sendMessage(`[WORDS CONFIRMED] ${summary}`);
    },
    onChooseOnboarding: async (choice: "add_words" | "browse_packs") => {
      if (choice === "add_words") {
        setPlaceholder("Paste your vocab, or tell me a word to add...");
        textareaRef.current?.focus();
        return;
      }
      setLoading(true);
      const res = await fetch("/api/v2/packs");
      const data = await res.json();
      setLoading(false);
      appendLocalMessage("Here's a pack to start with:", [{ type: "pack_list", packs: data.packs }]);
    },
    onStartPack: async (packId: string) => {
      setLoading(true);
      const res = await fetch("/api/v2/packs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const result = await res.json();
      await sendMessage(`[PACK STARTED] added ${result.count} words from the pack, ready whenever you want to test.`);
    },
  };

  const visibleMessages = messages.filter(
    (m) => !(m.role === "user" && HIDDEN_PREFIXES.some((prefix) => m.content.startsWith(prefix)))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {visibleMessages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={message.role === "user" ? "max-w-sm" : "max-w-md space-y-2"}>
              {message.content && (
                <div
                  className={
                    message.role === "user"
                      ? "rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm"
                      : "text-sm text-heading whitespace-pre-wrap"
                  }
                >
                  {message.content}
                </div>
              )}
              {message.widgets?.map((widget, i) => (
                <WidgetRenderer key={i} widget={widget} actions={actions} />
              ))}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-subtle">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={loading}
          className="min-h-[44px] max-h-40"
        />
        <Button onClick={handleSubmit} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
