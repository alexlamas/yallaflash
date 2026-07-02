"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowUp, ImagePlus, Trees, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WidgetRenderer, type WidgetActions } from "./WidgetRenderer";
import { MarkdownContent } from "./MarkdownContent";
import { ProgressPanel, type ProgressData } from "./ProgressPanel";
import { TutorStrip } from "./TutorStrip";
import type { ReviewTier, V2Message, V2Pack, Widget, WordProposal } from "@/app/v2/lib/types";
import { gradeDeterministic } from "@/app/v2/lib/gradingCore";

const STORAGE_KEY = "yallaflash_v2_conversation_id";

// Synthetic ground-truth messages fed back into the model after a
// widget-driven mutation (see tutorPrompt.ts) -- shown to the tutor, not the user.
const HIDDEN_PREFIXES = ["[REVIEW RESULT]", "[WORDS CONFIRMED]", "[PACK STARTED]", "[SERVED]"];

// Widget types that block the action chips while waiting on the user.
// onboarding_choice is deliberately NOT here: it's a suggestion, not a gate,
// so a conversation can never wedge on it (chips stay available alongside).
const INTERACTIVE_TYPES = new Set<Widget["type"]>([
  "quiz_mc",
  "recall_input",
  "produce_cold",
  "add_words_preview",
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
    const raw = data && (data as { error?: unknown }).error;
    const message =
      typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : `Request to ${url} failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// Longest side Claude's vision handles well; bigger is wasted upload.
const MAX_IMAGE_DIMENSION = 1600;
// Vercel drops request bodies over ~4.5MB (Safari reports it as a bare
// "Load failed"), and the extract API caps images at 5MB -- stay well under.
const MAX_IMAGE_DATA_URL_BYTES = 3_500_000;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that image."));
    reader.readAsDataURL(file);
  });
}

// Phone photos are 5-12MB and often HEIC, which the API can't take either
// way. Decode on-device, cap the longest side, and re-encode as JPEG,
// stepping quality down until it fits. Small already-compatible images are
// passed through untouched (keeps text screenshots crisp).
async function downscaleImage(file: File): Promise<string> {
  const original = await fileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't read that image format -- try a JPG or PNG."));
    el.src = original;
  });

  const fits =
    original.length <= MAX_IMAGE_DATA_URL_BYTES &&
    Math.max(img.width, img.height) <= MAX_IMAGE_DIMENSION &&
    /^data:image\/(jpeg|png|webp|gif)/.test(original);
  if (fits) return original;

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.5]) {
    const out = canvas.toDataURL("image/jpeg", quality);
    if (out.length <= MAX_IMAGE_DATA_URL_BYTES) return out;
  }
  return canvas.toDataURL("image/jpeg", 0.35);
}

export function ChatWindow() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState("Message your tutor...");
  const [loading, setLoading] = useState(false);
  // True only while an ambiguous answer waits on the model fallback --
  // deterministic grades never set this.
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // Interactions are tracked here (not just inside widget components) so the
  // chips bar knows whether the newest interactive widget is still waiting.
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set());
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // One shared progress fetch for the sidebar, mobile bar, sheet, and hero.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v2/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((result: ProgressData | null) => {
        if (!cancelled && result) setProgressData(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [progressKey]);

  const progressTotals = progressData
    ? progressData.counts.new + progressData.counts.learning + progressData.counts.learned
    : 0;
  const progressPercent =
    !progressData || progressTotals === 0
      ? 0
      : Math.round(
          ((progressData.counts.learned + 0.5 * progressData.counts.learning) / progressTotals) * 100
        );
  const dueNow = progressData?.counts.dueNow ?? 0;

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
    const loaded = data as V2Message[];
    // Which widgets were answered lives only in client state, so on reload
    // presume every interactive widget with any message after it (including
    // hidden ground-truth messages) was already handled -- otherwise an old
    // review card would come back to life and could double-grade.
    const seeded = new Set<string>();
    loaded.forEach((message, index) => {
      if (message.role !== "assistant" || !message.widgets) return;
      if (index === loaded.length - 1) return;
      message.widgets.forEach((widget, j) => {
        if (INTERACTIVE_TYPES.has(widget.type)) seeded.add(`${message.id}:${j}`);
      });
    });
    setAnsweredKeys(seeded);
    setConversationId(id);
    setMessages(loaded);
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

  function appendLocalMessage(content: string, widgets: Widget[] = []): string {
    const id = nextLocalId();
    setMessages((prev) => [
      ...prev,
      {
        id,
        conversation_id: conversationId ?? "",
        role: "assistant",
        content,
        widgets,
        created_at: new Date().toISOString(),
      },
    ]);
    return id;
  }

  // Updates the verdict widget in a local message after the background
  // scheduling call returns (real next_review_date, authoritative script).
  function patchVerdict(
    messageId: string,
    patch: Partial<Extract<Widget, { type: "review_verdict" }>>
  ) {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          widgets: (message.widgets ?? []).map((w) =>
            w.type === "review_verdict" ? { ...w, ...patch } : w
          ),
        };
      })
    );
  }

  // Looks a widget back up from its render key (`${message.id}:${index}`).
  function widgetForKey(key: string): Widget | null {
    const splitAt = key.lastIndexOf(":");
    const messageId = key.slice(0, splitAt);
    const index = Number(key.slice(splitAt + 1));
    const message = messages.find((m) => m.id === messageId);
    return message?.widgets?.[index] ?? null;
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

  async function handleAttachImage(file: File | undefined) {
    if (!file) return;
    try {
      setAttachedImage(await downscaleImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  // Image-add path: V1's vision extractor parses the photo deterministically
  // for the client (no chat-model round trip), then the standard
  // preview -> confirm flow takes over.
  async function extractFromImage() {
    if (!attachedImage) return;
    const caption = input.trim();
    const image = attachedImage;
    setInput("");
    setAttachedImage(null);
    setError(null);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        id: nextLocalId(),
        conversation_id: conversationId ?? "",
        role: "user",
        content: caption ? `Sent a photo: ${caption}` : "Sent a photo",
        widgets: [],
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const result = await fetchJSON<{
        words: { english: string; arabic: string; transliteration: string; type: string }[];
      }>("/api/words/bulk-extract", { image, text: caption || undefined });
      const proposals: WordProposal[] = (result.words ?? []).map((w) => ({
        arabizi: w.transliteration,
        script: w.arabic,
        english: w.english,
        type: w.type,
        notes: null,
        memory_hook: null,
      }));
      if (proposals.length === 0) {
        setError("Couldn't find any vocabulary in that image.");
        return;
      }
      appendLocalMessage(
        `Found ${proposals.length} word${proposals.length === 1 ? "" : "s"} in your photo -- confirm to add them:`,
        [{ type: "add_words_preview", proposals }]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't read that image.";
      // Safari says "Load failed", Chrome "Failed to fetch" when the request
      // itself dies (connection drop, body too large) -- neither helps a user.
      setError(
        /load failed|failed to fetch/i.test(message)
          ? "Upload failed -- check your connection and try again."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (attachedImage) {
      extractFromImage();
      return;
    }
    const text = input;
    setInput("");
    sendMessage(text);
  }

  type AnswerResult = {
    correct: boolean;
    arabizi: string;
    english: string;
    script: string | null;
    next_review_date: string;
  };

  // The whole point of this flow: multiple choice and exact matches are
  // decidable right here, so the verdict renders in the same frame as the
  // answer. The server round trip (SRS write + authoritative script) runs
  // in the background and patches the schedule in when it lands. Only
  // genuinely ambiguous answers (possible synonym, near-miss spelling) wait
  // on the server, behind a visible CHECKING state.
  async function answerReview(key: string, wordId: string, tier: ReviewTier, submitted: string) {
    setError(null);
    const widget = widgetForKey(key);
    const review = widget && isReviewWidget(widget) ? widget : null;
    const instant = review?.answer ? gradeDeterministic(tier, submitted, review.answer) : null;

    if (instant !== null && review?.answer) {
      recordAnswered(key);
      const verdictId = appendLocalMessage("", [
        {
          type: "review_verdict",
          correct: instant,
          submitted,
          arabizi: review.answer.arabizi,
          english: review.answer.english,
          script: review.cue?.script ?? null,
          next_review_date: "",
        },
      ]);
      try {
        const result = await fetchJSON<AnswerResult>("/api/v2/review/answer", { wordId, tier, submitted });
        refreshProgress();
        patchVerdict(verdictId, {
          correct: result.correct,
          script: result.script,
          next_review_date: result.next_review_date,
        });
        await sendMessage(
          `[REVIEW RESULT] word_id=${wordId} submitted="${submitted}" correct=${result.correct} arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that review.");
      }
      return;
    }

    // Ambiguous: the card stays up with a CHECKING state until the model
    // fallback rules, then the verdict lands as one transition.
    setChecking(true);
    try {
      const result = await fetchJSON<AnswerResult>("/api/v2/review/answer", { wordId, tier, submitted });
      recordAnswered(key);
      refreshProgress();
      appendLocalMessage("", [
        {
          type: "review_verdict",
          correct: result.correct,
          submitted,
          arabizi: result.arabizi,
          english: result.english,
          script: result.script,
          next_review_date: result.next_review_date,
        },
      ]);
      setChecking(false);
      await sendMessage(
        `[REVIEW RESULT] word_id=${wordId} submitted="${submitted}" correct=${result.correct} arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't grade that answer.");
    } finally {
      setChecking(false);
    }
  }

  const baseActions: WidgetActions = {
    onAnswer: () => {
      // Replaced per-widget in actionsFor -- answering needs the widget key.
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

  // Wrap actions so any interaction marks its widget as answered. Review
  // answers manage their own answered timing (instant for deterministic
  // grades, deferred past the CHECKING state for ambiguous ones).
  function actionsFor(key: string): WidgetActions {
    return {
      onAnswer: (wordId, tier, submitted) => {
        answerReview(key, wordId, tier, submitted);
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

  // Serves the next due card without a model round trip -- the chips should
  // feel instant. Falls back to the tutor when the conversation isn't ready.
  async function serveNext(excludeWordId?: string) {
    if (!conversationId) {
      sendMessage("next");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJSON<{ message: V2Message }>("/api/v2/review/next", {
        conversationId,
        excludeWordId,
      });
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't serve the next word.");
    } finally {
      setLoading(false);
    }
  }

  // "Show answer" is deterministic by definition (an automatic miss), so the
  // reveal is instant when the widget carries its answer; the SRS write and
  // tutor hand-off run in the background.
  async function concedePending() {
    if (!pending || !isReviewWidget(pending.widget)) return;
    const widget = pending.widget;
    recordAnswered(pending.key);
    setError(null);

    let verdictId: string | null = null;
    if (widget.answer) {
      verdictId = appendLocalMessage("", [
        {
          type: "review_verdict",
          correct: false,
          conceded: true,
          arabizi: widget.answer.arabizi,
          english: widget.answer.english,
          script: widget.cue?.script ?? null,
          next_review_date: "",
        },
      ]);
    }

    try {
      const result = await fetchJSON<AnswerResult>("/api/v2/review/answer", {
        wordId: widget.word_id,
        tier: widget.tier,
        concede: true,
      });
      refreshProgress();
      if (verdictId) {
        patchVerdict(verdictId, { script: result.script, next_review_date: result.next_review_date });
      } else {
        appendLocalMessage("", [
          {
            type: "review_verdict",
            correct: false,
            conceded: true,
            arabizi: result.arabizi,
            english: result.english,
            script: result.script,
            next_review_date: result.next_review_date,
          },
        ]);
      }
      await sendMessage(
        `[REVIEW RESULT] word_id=${widget.word_id} conceded=true correct=false arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reveal the answer.");
    }
  }

  const reviewPending = pending !== null && isReviewWidget(pending.widget);

  // Session-start hero: a returning user's first screen is a real "ready to
  // review" moment, not a lone chat bubble floating in gradient.
  const showHero =
    visibleMessages.length === 1 &&
    visibleMessages[0].role === "assistant" &&
    !(visibleMessages[0].widgets ?? []).some((w) => w.type === "onboarding_choice");

  const chips: { label: string; primary?: boolean; onClick: () => void }[] = (() => {
    if (loading || messages.length === 0 || showHero) return [];
    if (pending) {
      if (reviewPending) {
        const reviewWidget = pending.widget as ReviewWidget;
        return [
          { label: "Show answer", onClick: concedePending },
          {
            label: "Skip",
            onClick: () => {
              recordAnswered(pending.key);
              serveNext(reviewWidget.word_id);
            },
          },
          { label: "Hint", onClick: () => sendMessage("give me a hint") },
        ];
      }
      return [];
    }
    // A brand-new user mid-onboarding has nothing to review yet -- don't
    // offer a chip that can only dead-end.
    const onboardingShowing = visibleMessages.some((m) =>
      (m.widgets ?? []).some((w) => w.type === "onboarding_choice")
    );
    const hasStarted = visibleMessages.length > 1;
    const review = {
      label: hasStarted ? "Next word" : "Start review",
      primary: true,
      onClick: () => serveNext(),
    };
    return [
      ...(onboardingShowing && !hasStarted ? [] : [review]),
      { label: "Add words", onClick: () => sendMessage("I want to add some new words") },
    ];
  })();

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] max-w-sm mx-auto text-center gap-3 px-4">
        <div className="text-sm font-medium text-heading">Couldn&apos;t start the chat</div>
        <div className="text-sm text-subtle">{error}</div>
        <Button onClick={bootstrap} className="bg-green-600 hover:bg-green-700">
          Try again
        </Button>
      </div>
    );
  }

  function renderMessage(message: V2Message, messageIndex: number, inActiveView: boolean) {
    if (message.role === "user") {
      return (
        <div key={message.id} className="flex justify-end">
          <div className="max-w-sm rounded-2xl bg-green-700 text-white px-4 py-2 text-sm">
            {message.content}
          </div>
        </div>
      );
    }

    const isLastAssistant = messageIndex === visibleMessages.length - 1;

    // Wrapper element type stays constant (always motion.div) so an active
    // card turning inactive re-renders instead of remounting -- a remount
    // would reset the widget's internal answered state.
    const widgetElements = (message.widgets ?? []).map((widget, j) => {
      const key = `${message.id}:${j}`;
      const isActiveWidget =
        inActiveView && (pending?.key === key || (isLastAssistant && widget.type === "word_card"));
      // Entrance/exit animation lives on the message wrapper; this stays a
      // motion.div purely so the element type never changes (a remount would
      // reset the widget's internal answered state).
      return (
        <motion.div key={j} initial={false} className={cn(isActiveWidget && "py-3")}>
          <WidgetRenderer
            widget={widget}
            actions={actionsFor(key)}
            active={isActiveWidget}
            answered={answeredKeys.has(key)}
          />
        </motion.div>
      );
    });

    if (inActiveView) {
      // Stage layout: a verdict leads with the tutor's commentary below it,
      // but question cards FOLLOW the tutor's text -- a lead-in like
      // "First one:" dangling under the card reads like a stray reply.
      const cardFirst = (message.widgets ?? []).some((w) => w.type === "review_verdict");
      const strip = message.content && <TutorStrip text={message.content} />;
      return (
        <div key={message.id} className="w-full space-y-3">
          {cardFirst ? (
            <>
              {widgetElements}
              {strip}
            </>
          ) : (
            <>
              {strip}
              {widgetElements}
            </>
          )}
        </div>
      );
    }

    return (
      <div key={message.id} className="w-full space-y-3">
        {message.content && (
          <div className="max-w-lg">
            <MarkdownContent text={message.content} />
          </div>
        )}
        {widgetElements}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh]">
      <div className="relative flex flex-col flex-1 min-w-0 bg-gradient-to-b from-green-50/80 via-white to-white">
        <Link
          href="/"
          aria-label="Back to home"
          className="hidden lg:flex absolute top-4 left-4 z-10 h-9 w-9 rounded-full bg-white/80 backdrop-blur border border-gray-200 shadow-sm items-center justify-center text-gray-500 hover:text-heading hover:bg-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Mobile top bar: back, mini progress, and the panel behind a sheet */}
        <div className="lg:hidden flex items-center gap-3 px-3 py-2">
          <Link
            href="/"
            aria-label="Back to home"
            className="h-8 w-8 shrink-0 rounded-full bg-white/80 border border-gray-200 shadow-sm flex items-center justify-center text-gray-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 h-1.5 rounded-full bg-gray-200/70 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono text-subtle tabular-nums">{progressPercent}%</span>
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white shadow-sm px-3 py-1.5 text-xs font-medium text-heading">
                <Trees className="h-3.5 w-3.5 text-green-600" />
                {dueNow > 0 ? `${dueNow} due` : "Progress"}
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-[320px] bg-stone-50">
              <SheetTitle className="sr-only">Progress</SheetTitle>
              <ProgressPanel data={progressData} />
            </SheetContent>
          </Sheet>
        </div>
        {earlierMessages.length > 0 && (
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="w-full text-center text-xs text-gray-400 py-2.5 border-b border-dashed border-gray-200 hover:text-heading transition-colors"
          >
            {showHistory ? "Hide earlier messages" : `↑ ${earlierMessages.length} earlier messages`}
          </button>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div
            className={cn(
              "max-w-2xl mx-auto w-full flex flex-col gap-4",
              // Center the lone active exchange vertically for a stage feel;
              // with history expanded it behaves like a normal transcript.
              !showHistory && "min-h-full justify-center"
            )}
          >
            {showHistory && (
              <div className="space-y-4 pb-6 mb-2 border-b border-dashed opacity-80">
                {earlierMessages.map((message, i) => renderMessage(message, i, false))}
              </div>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              {showHero ? (
                <motion.div
                  key="session-hero"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="text-center space-y-6 py-8"
                >
                  <div className="text-[10px] font-mono tracking-[0.2em] text-subtle">
                    REVIEW QUEUE
                  </div>
                  <div>
                    <div className="font-title text-7xl text-heading leading-none">{dueNow}</div>
                    <div className="text-sm text-subtle mt-2">
                      {dueNow === 0
                        ? "all clear -- nothing due right now"
                        : dueNow === 1
                        ? "word due now"
                        : "words due now"}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2.5 flex-wrap">
                    {dueNow > 0 && (
                      <button
                        onClick={() => serveNext()}
                        disabled={loading}
                        className="rounded-full bg-green-600 hover:bg-green-700 text-white px-7 py-3 text-base font-medium shadow-sm transition-colors disabled:opacity-50"
                      >
                        Yalla, start review
                      </button>
                    )}
                    <button
                      onClick={() => sendMessage("I want to add some new words")}
                      disabled={loading}
                      className={cn(
                        "rounded-full px-6 py-3 text-base font-medium shadow-sm border transition-colors disabled:opacity-50",
                        dueNow > 0
                          ? "bg-white border-gray-200 text-heading hover:bg-gray-50"
                          : "bg-green-600 border-green-600 text-white hover:bg-green-700"
                      )}
                    >
                      Add words
                    </button>
                  </div>
                </motion.div>
              ) : (
                activeMessages.map((message, i) => (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -24, scale: 0.97 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    {renderMessage(message, activeStart + i, true)}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            {(loading || checking) && (
              <div className="flex justify-center" aria-live="polite">
                <span className="text-[11px] font-mono tracking-[0.14em] text-subtle animate-pulse">
                  {checking ? "CHECKING..." : "THINKING..."}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-5 pt-1 space-y-2.5">
          {error && (
            <div className="max-w-2xl mx-auto rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-700">
                Dismiss
              </button>
            </div>
          )}

          {chips.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-center">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  onClick={chip.onClick}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium border shadow-sm transition-colors",
                    chip.primary
                      ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
                      : "bg-white border-gray-200 text-heading hover:bg-gray-50"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {attachedImage && (
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage}
                alt="Attached"
                className="h-12 w-12 rounded-lg object-cover border border-gray-200 shadow-sm"
              />
              <span className="text-xs text-subtle">
                Photo attached -- send to extract vocabulary from it.
              </span>
              <button
                onClick={() => setAttachedImage(null)}
                aria-label="Remove photo"
                className="h-6 w-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-heading"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="max-w-2xl mx-auto flex items-end gap-2 rounded-2xl border border-gray-200 bg-white shadow-sm px-3 py-2 transition-shadow focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-500/20">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleAttachImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              aria-label="Add a photo"
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
            >
              <ImagePlus className="h-[18px] w-[18px]" />
            </button>
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                attachedImage
                  ? "Add a note about the photo (optional)..."
                  : reviewPending
                  ? "Ask about this word..."
                  : placeholder
              }
              disabled={loading}
              className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[30px] max-h-40 px-0 py-1.5 text-[15px] bg-transparent"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || (!input.trim() && !attachedImage)}
              aria-label="Send"
              className="h-9 w-9 shrink-0 rounded-full bg-green-600 text-white flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-35 disabled:hover:bg-green-600"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <aside className="hidden lg:flex w-72 shrink-0 border-l flex-col bg-stone-50/60">
        <ProgressPanel data={progressData} />
      </aside>
    </div>
  );
}
