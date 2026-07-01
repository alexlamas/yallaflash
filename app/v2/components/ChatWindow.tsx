"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WidgetRenderer, type WidgetActions } from "./WidgetRenderer";
import { MarkdownContent } from "./MarkdownContent";
import { ProgressPanel } from "./ProgressPanel";
import type { ReviewTier, V2Message, V2Pack, Widget, WordProposal } from "@/app/v2/lib/types";

const STORAGE_KEY = "yallaflash_v2_conversation_id";

// Synthetic ground-truth messages fed back into the model after a
// widget-driven mutation (see tutorPrompt.ts) -- shown to the tutor, not the user.
const HIDDEN_PREFIXES = ["[REVIEW RESULT]", "[WORDS CONFIRMED]", "[PACK STARTED]"];

// Widget types that wait on a user interaction.
const INTERACTIVE_TYPES = new Set<Widget["type"]>([
  "quiz_mc",
  "recall_input",
  "produce_cold",
  "add_words_preview",
  "onboarding_choice",
  "pack_list",
]);

type ReviewWidget = Extract<Widget, { type: "quiz_mc" | "recall_input" | "produce_cold" }>;

function isReviewWidget(widget: Widget): widget is ReviewWidget {
  return widget.type === "quiz_mc" || widget.type === "recall_input" || widget.type === "produce_cold";
}

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
  const [placeholder, setPlaceholder] = useState("Message your tutor...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  // Interactions are tracked here (not just inside widget components) so the
  // chips bar knows whether the newest interactive widget is still waiting.
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshProgress = () => setProgressKey((key) => key + 1);
  const recordAnswered = (key: string) =>
    setAnsweredKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      loadHistory(stored);
    } else {
      bootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) => !(m.role === "user" && HIDDEN_PREFIXES.some((prefix) => m.content.startsWith(prefix)))
      ),
    [messages]
  );

  // The newest interactive widget across the transcript; pending while
  // unanswered. Anything older than an answered interactive widget is stale.
  const pending = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const message = visibleMessages[i];
      if (message.role !== "assistant") continue;
      const widgets = message.widgets ?? [];
      for (let j = widgets.length - 1; j >= 0; j--) {
        const widget = widgets[j];
        if (!INTERACTIVE_TYPES.has(widget.type)) continue;
        const key = `${message.id}:${j}`;
        return answeredKeys.has(key) ? null : { widget, key, messageIndex: i };
      }
    }
    return null;
  }, [visibleMessages, answeredKeys]);

  // The steady view shows only the active exchange: the last assistant
  // message (plus the user message that prompted it), extended back to keep
  // a still-pending card on screen through hint/question exchanges.
  const activeStart = useMemo(() => {
    let lastAssistant = -1;
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (visibleMessages[i].role === "assistant") {
        lastAssistant = i;
        break;
      }
    }
    let start = lastAssistant >= 0 ? lastAssistant : 0;
    if (pending && pending.messageIndex < start) start = pending.messageIndex;
    if (start > 0 && visibleMessages[start - 1]?.role === "user") start -= 1;
    return start;
  }, [visibleMessages, pending]);

  const earlierMessages = visibleMessages.slice(0, activeStart);
  const activeMessages = visibleMessages.slice(activeStart);

  // Each new exchange returns to the steady single-turn view.
  useEffect(() => {
    setShowHistory(false);
  }, [visibleMessages.length]);

  useEffect(() => {
    if (showHistory && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [showHistory]);

  async function loadHistory(id: string) {
    setLoading(true);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("v2_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (loadError || !data || data.length === 0) {
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

  const baseActions: WidgetActions = {
    onAnswer: async (wordId: string, tier: ReviewTier, submitted: string) => {
      setError(null);
      try {
        const result = await fetchJSON<{
          correct: boolean;
          arabizi: string;
          script: string | null;
          next_review_date: string;
        }>("/api/v2/review/answer", { wordId, tier, submitted });
        refreshProgress();
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
        refreshProgress();
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
        refreshProgress();
        await sendMessage(`[PACK STARTED] added ${result.count} words from the pack, ready whenever you want to test.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start that pack.");
      }
    },
  };

  // Wrap actions so any interaction marks its widget as answered.
  function actionsFor(key: string): WidgetActions {
    return {
      onAnswer: (wordId, tier, submitted) => {
        recordAnswered(key);
        baseActions.onAnswer(wordId, tier, submitted);
      },
      onConfirmWords: (proposals) => {
        recordAnswered(key);
        baseActions.onConfirmWords(proposals);
      },
      onChooseOnboarding: (choice) => {
        recordAnswered(key);
        baseActions.onChooseOnboarding(choice);
      },
      onStartPack: (packId) => {
        recordAnswered(key);
        baseActions.onStartPack(packId);
      },
    };
  }

  async function concedePending() {
    if (!pending || !isReviewWidget(pending.widget)) return;
    const widget = pending.widget;
    recordAnswered(pending.key);
    setError(null);
    try {
      const result = await fetchJSON<{
        correct: boolean;
        arabizi: string;
        script: string | null;
        next_review_date: string;
      }>("/api/v2/review/answer", { wordId: widget.word_id, tier: widget.tier, concede: true });
      refreshProgress();
      await sendMessage(
        `[REVIEW RESULT] word_id=${widget.word_id} conceded=true correct=false arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reveal the answer.");
    }
  }

  const reviewPending = pending !== null && isReviewWidget(pending.widget);

  const chips: { label: string; primary?: boolean; onClick: () => void }[] = (() => {
    if (loading || messages.length === 0) return [];
    if (pending) {
      if (reviewPending) {
        return [
          { label: "Show answer", onClick: concedePending },
          {
            label: "Skip",
            onClick: () => {
              recordAnswered(pending.key);
              sendMessage("skip this one, come back to it later");
            },
          },
          { label: "Hint", onClick: () => sendMessage("give me a hint") },
        ];
      }
      return [];
    }
    return [
      { label: "Next word", primary: true, onClick: () => sendMessage("next") },
      { label: "Add words", onClick: () => sendMessage("I want to add some new words") },
    ];
  })();

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] max-w-sm mx-auto text-center gap-3 px-4">
        <div className="text-sm font-medium text-heading">Couldn&apos;t start the chat</div>
        <div className="text-sm text-subtle">{error}</div>
        <Button onClick={bootstrap}>Try again</Button>
      </div>
    );
  }

  function renderMessage(message: V2Message, messageIndex: number, inActiveView: boolean) {
    const isLastAssistant =
      message.role === "assistant" &&
      messageIndex === visibleMessages.length - 1;
    return (
      <div key={message.id} className={message.role === "user" ? "flex justify-end" : "block"}>
        <div className={message.role === "user" ? "max-w-sm" : "w-full space-y-3"}>
          {message.content &&
            (message.role === "user" ? (
              <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-2 text-sm">
                {message.content}
              </div>
            ) : (
              <div className="max-w-lg">
                <MarkdownContent text={message.content} />
              </div>
            ))}
          {message.widgets?.map((widget, j) => {
            const key = `${message.id}:${j}`;
            const isActiveWidget =
              inActiveView &&
              (pending?.key === key || (isLastAssistant && widget.type === "word_card"));
            return (
              <div key={j} className={isActiveWidget ? "py-3" : undefined}>
                <WidgetRenderer widget={widget} actions={actionsFor(key)} active={isActiveWidget} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-5xl mx-auto">
      <div className="flex flex-col flex-1 min-w-0">
        {earlierMessages.length > 0 && (
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="w-full text-center text-xs text-subtle py-2 border-b border-dashed hover:text-heading transition-colors"
          >
            {showHistory ? "Hide earlier messages" : `↑ ${earlierMessages.length} earlier messages`}
          </button>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {showHistory && (
            <div className="space-y-4 pb-6 mb-6 border-b border-dashed opacity-80">
              {earlierMessages.map((message, i) => renderMessage(message, i, false))}
            </div>
          )}
          {activeMessages.map((message, i) => renderMessage(message, activeStart + i, true))}
          {loading && <div className="text-sm text-subtle">Thinking...</div>}
        </div>

        {error && (
          <div className="px-4 py-2 text-sm bg-red-50 text-red-700 border-t flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-700">
              Dismiss
            </button>
          </div>
        )}

        {chips.length > 0 && (
          <div className="px-4 pt-3 flex gap-2 flex-wrap border-t bg-white">
            {chips.map((chip) => (
              <button
                key={chip.label}
                onClick={chip.onClick}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  chip.primary
                    ? "bg-primary text-primary-foreground border-primary hover:opacity-90"
                    : "bg-white border-gray-300 hover:bg-gray-50"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className={cn("p-3 flex gap-2 items-end", chips.length === 0 && "border-t")}>
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
            placeholder={reviewPending ? "Ask about this word..." : placeholder}
            disabled={loading}
            className="min-h-[40px] max-h-40"
          />
          <Button onClick={handleSubmit} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </div>

      <aside className="hidden lg:flex w-72 shrink-0 border-l flex-col">
        <ProgressPanel refreshKey={progressKey} />
      </aside>
    </div>
  );
}
