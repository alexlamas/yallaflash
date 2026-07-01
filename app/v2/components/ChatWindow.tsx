"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WidgetRenderer, type WidgetActions } from "./WidgetRenderer";
import type { ReviewTier, V2Message, V2Pack, Widget, WordProposal } from "@/app/v2/lib/types";

const STORAGE_KEY = "yallaflash_v2_conversation_id";

// Synthetic ground-truth messages fed back into the model after a
// widget-driven mutation (see tutorPrompt.ts) -- shown to the tutor, not the user.
const HIDDEN_PREFIXES = ["[REVIEW RESULT]", "[WORDS CONFIRMED]", "[PACK STARTED]"];

let localIdCounter = 0;
function nextLocalId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

// Fetches JSON and throws with the API's own error message on a non-2xx
// response, instead of letting callers hand a broken body to setState.
async function fetchJSON<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request to ${url} failed (${res.status})`);
  }
  return data as T;
}

export function ChatWindow() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState("Ask your tutor anything...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    try {
      const data = await fetchJSON<{ conversationId: string; message: V2Message }>("/api/v2/chat", {});
      window.localStorage.setItem(STORAGE_KEY, data.conversationId);
      setConversationId(data.conversationId);
      setMessages([data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the chat.");
    } finally {
      setLoading(false);
    }
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
    setError(null);
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

    try {
      const data = await fetchJSON<{ conversationId: string; message: V2Message }>("/api/v2/chat", {
        conversationId,
        message: text,
      });
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That message didn't send.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const text = input;
    setInput("");
    sendMessage(text);
  }

  const actions: WidgetActions = {
    onAnswer: async (wordId: string, tier: ReviewTier, submitted: string) => {
      setError(null);
      try {
        const result = await fetchJSON<{
          correct: boolean;
          arabizi: string;
          script: string | null;
          next_review_date: string;
        }>("/api/v2/review/answer", { wordId, tier, submitted });
        await sendMessage(
          `[REVIEW RESULT] word_id=${wordId} submitted="${submitted}" correct=${result.correct} arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't grade that answer.");
      }
    },
    onConfirmWords: async (proposals: WordProposal[]) => {
      setError(null);
      try {
        const result = await fetchJSON<{ words: { arabizi: string; english: string }[] }>(
          "/api/v2/words/confirm",
          { proposals }
        );
        const summary = (result.words ?? []).map((w) => `${w.arabizi} = ${w.english}`).join(", ");
        await sendMessage(`[WORDS CONFIRMED] ${summary}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save those words.");
      }
    },
    onChooseOnboarding: async (choice: "add_words" | "browse_packs") => {
      if (choice === "add_words") {
        setPlaceholder("Paste your vocab, or tell me a word to add...");
        textareaRef.current?.focus();
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const data = await fetchJSON<{ packs: V2Pack[] }>("/api/v2/packs");
        appendLocalMessage("Here's a pack to start with:", [{ type: "pack_list", packs: data.packs }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load packs.");
      } finally {
        setLoading(false);
      }
    },
    onStartPack: async (packId: string) => {
      setError(null);
      try {
        const result = await fetchJSON<{ count: number }>("/api/v2/packs/start", { packId });
        await sendMessage(`[PACK STARTED] added ${result.count} words from the pack, ready whenever you want to test.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start that pack.");
      }
    },
  };

  const visibleMessages = messages.filter(
    (m) => !(m.role === "user" && HIDDEN_PREFIXES.some((prefix) => m.content.startsWith(prefix)))
  );

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] max-w-sm mx-auto text-center gap-3 px-4">
        <div className="text-sm font-medium text-heading">Couldn&apos;t start the chat</div>
        <div className="text-sm text-subtle">{error}</div>
        <Button onClick={bootstrap}>Try again</Button>
      </div>
    );
  }

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

      {error && (
        <div className="px-4 py-2 text-sm bg-red-50 text-red-700 border-t flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

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
