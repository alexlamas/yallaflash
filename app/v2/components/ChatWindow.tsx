"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  ArchiveRestore,
  ArrowUp,
  FlaskConical,
  ImagePlus,
  LogOut,
  RotateCcw,
  SlidersHorizontal,
  Table2,
  Trees,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { WidgetRenderer, type WidgetActions } from "./WidgetRenderer";
import { MarkdownContent } from "./MarkdownContent";
import { ProgressPanel, type ProgressData } from "./ProgressPanel";
import { TutorStrip } from "./TutorStrip";
import { TypingIndicator } from "./TypingIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReviewTier, V2Message, V2Pack, Widget, WordProposal } from "@/app/v2/lib/types";
import { gradeDeterministic } from "@/app/v2/lib/gradingCore";
import { apiFetch, apiJSON as fetchJSON } from "@/app/v2/lib/api";
import { reviewHaptic, scheduleReviewReminder } from "@/app/v2/lib/native";

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
  "word_picker",
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
    el.onerror = () => reject(new Error("Couldn't read that image format — try a JPG or PNG."));
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

// V2's app menu, hanging off the logo: the chat IS the app, so it carries
// its own session controls instead of borrowing V1's header.
const SNAPSHOT_KEY = "yallaflash_v2_snapshot";

function AccountMenu({
  triggerClassName,
  onNewSession,
}: {
  triggerClassName?: string;
  onNewSession?: () => void;
}) {
  // Admin test tools: become a brand-new user (snapshot saved locally),
  // then restore the real data afterwards.
  async function testAsNewUser() {
    const res = await apiFetch("/api/v2/dev/reset", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.snapshot) {
      window.alert("Reset failed — nothing was changed.");
      return;
    }
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data.snapshot));
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  async function restoreMyData() {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      window.alert("No snapshot found in this browser.");
      return;
    }
    const res = await apiFetch("/api/v2/dev/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: JSON.parse(raw) }),
    });
    if (!res.ok) {
      window.alert("Restore failed — your snapshot is still saved in this browser.");
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
  async function handleLogout() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className={cn(
            "shrink-0 rounded-full bg-white/80 backdrop-blur border border-gray-200 shadow-sm flex items-center justify-center hover:bg-white transition-colors",
            triggerClassName
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {onNewSession && (
          <DropdownMenuItem onClick={onNewSession} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-gray-500" /> New session
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/words" className="flex items-center gap-2">
            <Table2 className="h-4 w-4 text-gray-500" /> My words
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/coaching" className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-gray-500" /> Coaching
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-gray-500" /> Old app
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={testAsNewUser} className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-gray-500" /> Test as new user
        </DropdownMenuItem>
        <DropdownMenuItem onClick={restoreMyData} className="flex items-center gap-2">
          <ArchiveRestore className="h-4 w-4 text-gray-500" /> Restore my data
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-gray-500" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Staggered hero entrance: each block rises in ~70ms after the previous one,
// so the queue count, copy, and actions read as a sequence rather than one slab.
const heroItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
} as const;

export function ChatWindow() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<V2Message[]>([]);
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState("Message your tutor...");
  const [loading, setLoading] = useState(false);
  // True only while an ambiguous answer waits on the model fallback --
  // deterministic grades never set this.
  const [checking, setChecking] = useState(false);
  // Background tutor commentary in flight (post-verdict) -- shows the typing
  // indicator without blocking the chips, so Next word stays available.
  const [commentaryPending, setCommentaryPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The next card, fetched while the user reads the current verdict, so
  // Next word renders with zero wait.
  const prefetchRef = useRef<ReviewWidget | null>(null);
  // The word just graded -- excluded when the user advances, so a card can't
  // be re-served before its SRS write lands.
  const lastReviewedRef = useRef<string | null>(null);
  // Words the user took a hint on -- a hinted correct answer schedules as
  // "struggled", not a full success.
  const hintedRef = useRef<Set<string>>(new Set());
  // Running tally for the session-cleared summary card.
  const sessionStats = useRef({ reviewed: 0, correct: 0 });
  const [progressKey, setProgressKey] = useState(0);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // Interactions are tracked here (not just inside widget components) so the
  // chips bar knows whether the newest interactive widget is still waiting.
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set());
  // Ref mirror for in-flight async completions: a closure captured before an
  // answer landed would otherwise see a stale set (a background reply once
  // spliced itself ABOVE an already-answered card because of this).
  const answeredKeysRef = useRef<Set<string>>(new Set());
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshProgress = () => setProgressKey((key) => key + 1);
  const syncAnsweredKeys = (next: Set<string>) => {
    answeredKeysRef.current = next;
    setAnsweredKeys(next);
  };
  const recordAnswered = (key: string) => {
    const next = new Set(answeredKeysRef.current);
    next.add(key);
    syncAnsweredKeys(next);
  };

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
    apiFetch("/api/v2/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((result: ProgressData | null) => {
        if (cancelled || !result) return;
        setProgressData(result);
        // Native app: keep one on-device reminder pointed at the next time
        // words come due, replaced on every refresh (open, graded answer).
        const now = Date.now();
        const nextDue = result.words
          .map((w) => w.next_review_date)
          .filter((d) => new Date(d).getTime() > now)
          .sort()[0];
        scheduleReviewReminder(nextDue ?? null);
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

  // The verdict "landing" screen: after an answer the session parks on the
  // verdict (no auto-advance), so the tutor's commentary and any explain/
  // example follow-ups all attach to THIS word. Showing when the newest
  // widget-bearing message is a verdict and no card is waiting.
  const verdictIndex = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const widgets = visibleMessages[i].widgets ?? [];
      if (widgets.length === 0) continue;
      return widgets.some((w) => w.type === "review_verdict") ? i : null;
    }
    return null;
  }, [visibleMessages]);
  const verdictShowing = !pending && verdictIndex !== null;

  // The steady view shows only the active exchange: the last assistant
  // message (plus the user message that prompted it), extended back to keep
  // a still-pending card on screen through hint/question exchanges, and a
  // showing verdict on screen through explain/example follow-ups. The active
  // view is always ONE word's exchange -- turns never mix.
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
    if (!pending && verdictIndex !== null && verdictIndex < start) start = verdictIndex;
    if (start > 0 && visibleMessages[start - 1]?.role === "user") start -= 1;
    return start;
  }, [visibleMessages, pending, verdictIndex]);

  const earlierMessages = visibleMessages.slice(0, activeStart);
  const activeMessages = visibleMessages.slice(activeStart);

  // Each new exchange returns to the steady single-turn view.
  useEffect(() => {
    setShowHistory(false);
  }, [visibleMessages.length]);

  // Enter (or N) advances to the next word once a verdict is showing --
  // reviewing never needs the mouse.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key.toLowerCase() !== "n") return;
      const target = event.target as HTMLElement | null;
      // Buttons handle their own Enter -- firing the shortcut too would
      // trigger a focused chip AND advance in the same keypress.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON"))
        return;
      if (pending || loading || checking) return;
      if (verdictShowing) serveNext(lastReviewedRef.current ?? undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, loading, checking, verdictShowing, conversationId]);

  useEffect(() => {
    if (showHistory && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [showHistory]);

  // A long verdict+commentary+card exchange can extend below the fold
  // (worst on mobile with the keyboard up) -- keep the newest content in
  // view whenever the transcript grows or a typing indicator appears.
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [visibleMessages.length, loading, checking, commentaryPending, reduceMotion]);

  // A conversation is a SESSION, not a lifetime: after this much quiet the
  // next visit starts fresh. Durable knowledge (words, notes, coaching
  // instructions) lives in the DB, not in chat scrollback, so nothing is
  // lost -- old sessions stay stored under their conversation ids.
  const SESSION_MAX_QUIET_HOURS = 6;

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
    const lastAt = new Date(data[data.length - 1].created_at).getTime();
    if (Date.now() - lastAt > SESSION_MAX_QUIET_HOURS * 3600_000) {
      await bootstrap();
      return;
    }
    const loaded = data as V2Message[];
    // Which widgets were answered lives only in client state, so on reload
    // presume every interactive widget was handled -- EXCEPT the open card:
    // the newest interactive widget, when it's a review card with no later
    // [REVIEW RESULT] for its word (the server's own open-card rule).
    // Background result/commentary rows persist AFTER the next card, so the
    // naive "anything with a message after it" wrongly disabled live cards.
    const resultWordIds = new Set<string>();
    for (const message of loaded) {
      if (message.role === "user" && message.content.startsWith("[REVIEW RESULT]")) {
        const match = message.content.match(/word_id=(\S+)/);
        if (match) resultWordIds.add(match[1]);
      }
    }
    let openKey: string | null = null;
    outer: for (let i = loaded.length - 1; i >= 0; i--) {
      const message = loaded[i];
      if (message.role !== "assistant") continue;
      const widgets = message.widgets ?? [];
      for (let j = widgets.length - 1; j >= 0; j--) {
        const widget = widgets[j];
        if (!INTERACTIVE_TYPES.has(widget.type)) continue;
        if (isReviewWidget(widget) && !resultWordIds.has(widget.word_id)) {
          openKey = `${message.id}:${j}`;
        }
        break outer;
      }
    }
    const seeded = new Set<string>();
    loaded.forEach((message, index) => {
      if (message.role !== "assistant" || !message.widgets) return;
      if (index === loaded.length - 1) return;
      message.widgets.forEach((widget, j) => {
        const key = `${message.id}:${j}`;
        if (INTERACTIVE_TYPES.has(widget.type) && key !== openKey) seeded.add(key);
      });
    });
    syncAnsweredKeys(seeded);
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
      syncAnsweredKeys(new Set());
      prefetchRef.current = null;
      hintedRef.current.clear();
      sessionStats.current = { reviewed: 0, correct: 0 };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the chat.");
    } finally {
      setLoading(false);
    }
  }

  // Manual fresh start (menu -> New session). The old conversation stays
  // stored; the tutor's durable memory is in the DB either way.
  function startNewSession() {
    window.localStorage.removeItem(STORAGE_KEY);
    bootstrap();
  }

  function appendLocalMessage(
    content: string,
    widgets: Widget[] = [],
    { persist = false } = {}
  ): string {
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
    // Reload-critical widgets (photo previews, pack lists, pickers) survive
    // via a background insert; the live session keeps this local copy, and
    // the reload path picks up the persisted row instead.
    if (persist && conversationId) {
      fetchJSON("/api/v2/messages", { conversationId, content, widgets }).catch((err) =>
        console.error("[appendLocalMessage] persist failed", err)
      );
    }
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

  // background: true keeps the chips alive while the tutor works -- used for
  // hidden ground-truth messages ([REVIEW RESULT] etc.) whose commentary is
  // a nicety, not something the user should wait on.
  async function sendMessage(text: string, { background = false } = {}): Promise<boolean> {
    if (!text.trim()) return false;
    if (background) setCommentaryPending(true);
    else setLoading(true);
    setError(null);
    const localUserId = nextLocalId();
    setMessages((prev) => [
      ...prev,
      {
        id: localUserId,
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
      setMessages((prev) => {
        // Race guard for background commentary: if the user already advanced
        // to a new card, this reply is about the PREVIOUS word -- slot it in
        // before the new card so it stays with its own exchange instead of
        // reading as a reply to the card on the table.
        if (background) {
          for (let i = prev.length - 1; i >= 0; i--) {
            const widgets = prev[i].widgets ?? [];
            const j = widgets.findIndex((w) => isReviewWidget(w));
            if (j === -1) continue;
            if (!answeredKeysRef.current.has(`${prev[i].id}:${j}`)) {
              const copy = [...prev];
              copy.splice(i, 0, data.message);
              return copy;
            }
            break;
          }
        }
        return [...prev, data.message];
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That message didn't send.");
      // The optimistic bubble would sit there looking sent -- take it back
      // out; the caller decides how to retry (handleSubmit restores the text).
      setMessages((prev) => prev.filter((m) => m.id !== localUserId));
      return false;
    } finally {
      if (background) setCommentaryPending(false);
      else setLoading(false);
    }
  }

  // Prefetches the next due card (no conversation writes) while the user
  // reads the current verdict -- Next word then renders instantly.
  function prefetchNext(excludeWordId?: string) {
    if (!conversationId) return;
    fetchJSON<{ widget?: ReviewWidget | null }>("/api/v2/review/next", {
      conversationId,
      excludeWordId,
      peek: true,
    })
      .then((data) => {
        prefetchRef.current = data.widget ?? null;
      })
      .catch(() => {
        prefetchRef.current = null;
      });
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
        `Found ${proposals.length} word${proposals.length === 1 ? "" : "s"} in your photo — confirm to add them:`,
        [{ type: "add_words_preview", proposals }],
        { persist: true }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't read that image.";
      // Safari says "Load failed", Chrome "Failed to fetch" when the request
      // itself dies (connection drop, body too large) -- neither helps a user.
      setError(
        /load failed|failed to fetch/i.test(message)
          ? "Upload failed — check your connection and try again."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    // Typing stays open while the tutor works; sending waits its turn so
    // two in-flight conversation writes can't interleave.
    if (loading || checking) return;
    if (attachedImage) {
      extractFromImage();
      return;
    }
    const text = input;
    setInput("");
    const ok = await sendMessage(text);
    // A failed send must not eat the typed message -- put it back (unless
    // the user already started typing something new).
    if (!ok) setInput((current) => current || text);
  }

  type AnswerResult = {
    correct: boolean;
    arabizi: string;
    english: string;
    script: string | null;
    next_review_date: string;
    image_url: string | null;
  };

  // The whole point of this flow: multiple choice and exact matches are
  // decidable right here, so the verdict renders in the same frame as the
  // answer. The server round trip (SRS write + authoritative script) runs
  // in the background and patches the schedule in when it lands. Only
  // genuinely ambiguous answers (possible synonym, near-miss spelling) wait
  // on the server, behind a visible CHECKING state.
  async function answerReview(
    key: string,
    wordId: string,
    tier: ReviewTier,
    submitted: string
  ): Promise<boolean> {
    setError(null);
    const widget = widgetForKey(key);
    const review = widget && isReviewWidget(widget) ? widget : null;
    const instant = review?.answer ? gradeDeterministic(tier, submitted, review.answer) : null;
    const hinted = hintedRef.current.has(wordId);
    hintedRef.current.delete(wordId);

    if (instant !== null && review?.answer) {
      recordAnswered(key);
      reviewHaptic(instant);
      const verdictId = appendLocalMessage("", [
        {
          type: "review_verdict",
          correct: instant,
          hinted: hinted && instant,
          submitted,
          arabizi: review.answer.arabizi,
          english: review.answer.english,
          script: review.cue?.script ?? null,
          next_review_date: "",
        },
      ]);
      sessionStats.current.reviewed += 1;
      if (instant) sessionStats.current.correct += 1;
      // Park on the verdict; the user advances explicitly (chip or Enter).
      // Warm the next card now so advancing is still instant.
      lastReviewedRef.current = wordId;
      prefetchNext(wordId);
      try {
        const result = await fetchJSON<AnswerResult>("/api/v2/review/answer", { wordId, tier, submitted, hinted });
        refreshProgress();
        patchVerdict(verdictId, {
          correct: result.correct,
          script: result.script,
          next_review_date: result.next_review_date,
          image_url: result.image_url,
        });
        await sendMessage(
          `[REVIEW RESULT] word_id=${wordId} submitted="${submitted}" correct=${result.correct}${hinted ? " hinted=true (counts as struggled -- shorter interval)" : ""} arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`,
          { background: true }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save that review.");
        // The verdict stands visually but nothing was scheduled -- flag it
        // plainly and take it back out of the session tally.
        patchVerdict(verdictId, { save_failed: true });
        sessionStats.current.reviewed -= 1;
        if (instant) sessionStats.current.correct -= 1;
      }
      return true;
    }

    // Ambiguous: the card stays up with a CHECKING state until the model
    // fallback rules, then the verdict lands as one transition.
    setChecking(true);
    try {
      const result = await fetchJSON<AnswerResult>("/api/v2/review/answer", { wordId, tier, submitted, hinted });
      recordAnswered(key);
      reviewHaptic(result.correct);
      refreshProgress();
      appendLocalMessage("", [
        {
          type: "review_verdict",
          correct: result.correct,
          hinted: hinted && result.correct,
          submitted,
          arabizi: result.arabizi,
          english: result.english,
          script: result.script,
          next_review_date: result.next_review_date,
          image_url: result.image_url,
        },
      ]);
      setChecking(false);
      sessionStats.current.reviewed += 1;
      if (result.correct) sessionStats.current.correct += 1;
      lastReviewedRef.current = wordId;
      prefetchNext(wordId);
      await sendMessage(
        `[REVIEW RESULT] word_id=${wordId} submitted="${submitted}" correct=${result.correct} arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`,
        { background: true }
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't grade that answer.");
      // Nothing was graded or recorded -- the card re-enables so the same
      // answer can be resubmitted instead of wedging the review.
      return false;
    } finally {
      setChecking(false);
    }
  }

  // Mutating actions resolve true only when the write lands, so widgets (and
  // the answered record below) commit on success -- never optimistically.
  const baseActions: WidgetActions = {
    onAnswer: async () => {
      // Replaced per-widget in actionsFor -- answering needs the widget key.
      return false;
    },
    onConfirmWords: async (proposals: WordProposal[]) => {
      setError(null);
      try {
        const result = await fetchJSON<{ words: { arabizi: string; english: string }[]; skipped?: number }>(
          "/api/v2/words/confirm",
          { proposals }
        );
        const summary = (result.words ?? []).map((w) => `${w.arabizi} = ${w.english}`).join(", ");
        const skippedNote = result.skipped
          ? ` (${result.skipped} skipped -- already in the user's collection; mention this briefly)`
          : "";
        refreshProgress();
        await sendMessage(`[WORDS CONFIRMED] ${summary || "none added"}${skippedNote}`, { background: true });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save those words.");
        return false;
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
        appendLocalMessage("Here's a pack to start with:", [{ type: "pack_list", packs: data.packs }], {
          persist: true,
        });
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
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start that pack.");
        return false;
      }
    },
    onStartWords: async (wordIds: string[]) => {
      setError(null);
      try {
        await fetchJSON<{ count: number }>("/api/v2/words/start", { wordIds });
        refreshProgress();
        // The picked words are due now -- serve the first immediately, and
        // let the tutor know off the critical path.
        sendMessage(
          `[PACK STARTED] the user picked ${wordIds.length} new words from the packs to start learning; the app is serving the first card now.`,
          { background: true }
        );
        await serveNext();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start those words.");
        return false;
      }
    },
    onDismiss: () => {},
  };

  // Wrap actions so a SUCCESSFUL interaction marks its widget as answered.
  // Review answers manage their own answered timing (instant for
  // deterministic grades, deferred past the CHECKING state for ambiguous
  // ones); dismissing counts as answered so an unwanted offer stops gating
  // the chips.
  function actionsFor(key: string): WidgetActions {
    return {
      onAnswer: (wordId, tier, submitted) => answerReview(key, wordId, tier, submitted),
      onConfirmWords: async (proposals) => {
        const ok = await baseActions.onConfirmWords(proposals);
        if (ok) recordAnswered(key);
        return ok;
      },
      onChooseOnboarding: (choice) => {
        recordAnswered(key);
        baseActions.onChooseOnboarding(choice);
      },
      onStartPack: async (packId) => {
        const ok = await baseActions.onStartPack(packId);
        if (ok) recordAnswered(key);
        return ok;
      },
      onStartWords: async (wordIds) => {
        const ok = await baseActions.onStartWords(wordIds);
        if (ok) recordAnswered(key);
        return ok;
      },
      onDismiss: () => recordAnswered(key),
    };
  }

  // Serves the next due card without a model round trip. A prefetched card
  // renders with zero wait (the conversation record catches up in the
  // background); otherwise one fast POST. When the queue is empty, the
  // client owns the session-cleared moment.
  async function serveNext(excludeWordId?: string, { ahead = false } = {}) {
    if (!conversationId) {
      sendMessage("next");
      return;
    }
    setError(null);

    const cached = prefetchRef.current;
    if (!ahead && cached && cached.word_id !== excludeWordId) {
      prefetchRef.current = null;
      appendLocalMessage("", [cached]);
      fetchJSON("/api/v2/review/next", { conversationId, commitWidget: cached }).catch((err) => {
        // A silently dropped commit means the card never reaches the stored
        // conversation (or the tutor) -- say so instead of console-only.
        console.error("[serveNext] commit failed", err);
        setError("Couldn't record this card in the conversation — answers still count.");
      });
      // Warm the cache for the card after this one.
      prefetchNext(cached.word_id);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchJSON<{
        message?: V2Message;
        done?: boolean;
        excludedStillDue?: boolean;
      }>("/api/v2/review/next", {
        conversationId,
        excludeWordId,
        ahead,
      });
      if (data.done || !data.message) {
        const stats = sessionStats.current;
        sessionStats.current = { reviewed: 0, correct: 0 };
        appendLocalMessage(
          // A skipped word is still due -- "queue cleared" would be a lie.
          data.excludedStillDue
            ? "All done — except the word you skipped, which is still due."
            : stats.reviewed > 0
            ? "Queue cleared — that's everything due."
            : "Nothing due right now.",
          stats.reviewed > 0
            ? [{ type: "session_summary", reviewed: stats.reviewed, correct: stats.correct }]
            : []
        );
        refreshProgress();
        return;
      }
      setMessages((prev) => [...prev, data.message!]);
      const served = (data.message.widgets ?? []).find((w) => isReviewWidget(w));
      if (served && isReviewWidget(served)) prefetchNext(served.word_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't serve the next word.");
    } finally {
      setLoading(false);
    }
  }

  // Zero-due path: offer fresh reservoir words (pack words never started) as
  // a picker widget. Starting them makes them due, so review continues.
  async function learnNewWords() {
    setError(null);
    setLoading(true);
    try {
      const data = await fetchJSON<{ candidates: Extract<Widget, { type: "word_picker" }>["candidates"] }>(
        "/api/v2/words/discover",
        {}
      );
      if ((data.candidates ?? []).length === 0) {
        appendLocalMessage(
          "You've started everything in the packs! Paste new words, snap a photo, or just tell me what you heard."
        );
        return;
      }
      appendLocalMessage("", [{ type: "word_picker", candidates: data.candidates }], { persist: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find new words.");
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
    // A concede wipes any hint taken -- otherwise the flag would silently
    // penalize this word's NEXT (unhinted) correct answer in-session.
    hintedRef.current.delete(widget.word_id);
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
        patchVerdict(verdictId, {
          script: result.script,
          next_review_date: result.next_review_date,
          image_url: result.image_url,
        });
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
      sessionStats.current.reviewed += 1;
      lastReviewedRef.current = widget.word_id;
      prefetchNext(widget.word_id);
      await sendMessage(
        `[REVIEW RESULT] word_id=${widget.word_id} conceded=true correct=false arabizi="${result.arabizi}" script="${result.script ?? ""}" next_review_date="${result.next_review_date}"`,
        { background: true }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reveal the answer.");
    }
  }

  const reviewPending = pending !== null && isReviewWidget(pending.widget);

  // Session-start hero: a returning user's first screen is a real "ready to
  // review" moment, not a lone chat bubble floating in gradient. Waits for
  // the progress fetch -- otherwise it flashes "0 due, all clear" at someone
  // with a full queue.
  const showHero =
    progressData !== null &&
    visibleMessages.length === 1 &&
    visibleMessages[0].role === "assistant" &&
    !(visibleMessages[0].widgets ?? []).some((w) => w.type === "onboarding_choice");

  const chips: { label: string; kbd?: string; primary?: boolean; onClick: () => void }[] = (() => {
    // checking included: Show answer/Skip during the model-fallback grade
    // would double-grade the same card.
    if (loading || checking || messages.length === 0 || showHero) return [];
    if (pending) {
      if (reviewPending) {
        const reviewWidget = pending.widget as ReviewWidget;
        return [
          { label: "Show answer", onClick: concedePending },
          {
            label: "Skip",
            onClick: () => {
              recordAnswered(pending.key);
              hintedRef.current.delete(reviewWidget.word_id);
              serveNext(reviewWidget.word_id);
            },
          },
          {
            label: "Hint",
            onClick: () => {
              // A hinted answer schedules as "struggled", not a full success
              // -- but only count the hint if the request actually went out.
              sendMessage("give me a hint").then((ok) => {
                if (ok) hintedRef.current.add(reviewWidget.word_id);
              });
            },
          },
        ];
      }
      return [];
    }
    // Verdict screen: the user decides when the turn ends. Digging in
    // (explain, example) keeps the tutor on THIS word; Enter advances.
    if (verdictShowing) {
      return [
        {
          label: "Next word",
          kbd: "↵",
          primary: true,
          onClick: () => serveNext(lastReviewedRef.current ?? undefined),
        },
        { label: "Explain more", onClick: () => sendMessage("Tell me more about this word") },
        { label: "Give an example", onClick: () => sendMessage("Use it in an example sentence") },
      ];
    }
    // A brand-new user mid-onboarding has nothing to review yet -- don't
    // offer a chip that can only dead-end.
    const onboardingShowing = visibleMessages.some((m) =>
      (m.widgets ?? []).some((w) => w.type === "onboarding_choice")
    );
    const hasStarted = visibleMessages.length > 1;
    const addWords = { label: "Add words", onClick: () => sendMessage("I want to add some new words") };

    // Queue empty: learning shouldn't dead-end. Offer fresh reservoir words
    // or a boost-style early review instead of a Next word that no-ops.
    // (Only once progress has actually loaded -- dueNow defaults to 0.)
    if (dueNow === 0 && progressData !== null && hasStarted && !onboardingShowing) {
      return [
        { label: "Learn new words", primary: true, onClick: learnNewWords },
        { label: "Review ahead", onClick: () => serveNext(undefined, { ahead: true }) },
        addWords,
      ];
    }

    const review = {
      label: hasStarted ? "Next word" : "Start review",
      primary: true,
      onClick: () => serveNext(),
    };
    return [...(onboardingShowing && !hasStarted ? [] : [review]), addWords];
  })();

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] max-w-sm mx-auto text-center gap-3 px-4" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
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
    // reducedMotion="user" turns off every framer animation in the chat for
    // prefers-reduced-motion users -- per-component checks don't scale.
    <MotionConfig reducedMotion="user">
    <div
      className="flex h-[100dvh]"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative flex flex-col flex-1 min-w-0 bg-gradient-to-b from-green-50/80 via-white to-white">
        {/* V2 owns its shell: the logo is the app menu (log out, old app). */}
        <div className="hidden lg:block absolute top-4 left-4 z-10">
          <AccountMenu triggerClassName="h-9 w-9" onNewSession={startNewSession} />
        </div>

        {/* Mobile top bar: menu, mini progress, and the panel behind a sheet */}
        <div className="lg:hidden flex items-center gap-3 px-3 py-2">
          <AccountMenu triggerClassName="h-8 w-8" onNewSession={startNewSession} />
          <div
            className="flex-1 h-1.5 rounded-full bg-gray-200/70 overflow-hidden"
            role="progressbar"
            aria-label="Learning progress"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-green-500 rounded-full transition-[width] duration-700"
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
            <SheetContent side="right" className="p-0 w-[320px] bg-gray-50">
              <SheetTitle className="sr-only">Progress</SheetTitle>
              <ProgressPanel data={progressData} />
            </SheetContent>
          </Sheet>
        </div>
        {earlierMessages.length > 0 && (
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="w-full text-center text-xs text-subtle py-2.5 border-b border-dashed border-gray-200 hover:text-heading transition-colors"
          >
            {showHistory ? (
              "Hide earlier messages"
            ) : (
              <>
                <span aria-hidden="true">↑ </span>
                {earlierMessages.length} earlier messages
              </>
            )}
          </button>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          {/* role=log announces appended tutor replies/verdicts to screen
              readers -- without it the whole conversation is silent. */}
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
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
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -16, transition: { duration: 0.18, ease: "easeOut" } }}
                  variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
                  className="text-center space-y-6 py-8"
                >
                  <motion.div
                    variants={heroItem}
                    className="text-[10px] font-mono tracking-[0.2em] text-subtle"
                  >
                    REVIEW QUEUE
                  </motion.div>
                  <motion.div variants={heroItem}>
                    <div className="font-title text-7xl text-heading leading-none tabular-nums">
                      {dueNow}
                    </div>
                    <div className="text-sm text-subtle mt-2">
                      {dueNow === 0
                        ? "All clear — nothing due right now"
                        : dueNow === 1
                        ? "word due now"
                        : "words due now"}
                    </div>
                  </motion.div>
                  <motion.div
                    variants={heroItem}
                    className="flex items-center justify-center gap-2.5 flex-wrap"
                  >
                    {dueNow > 0 ? (
                      <button
                        onClick={() => serveNext()}
                        disabled={loading}
                        className="rounded-full bg-green-600 hover:bg-green-700 text-white px-7 py-3 text-base font-medium shadow-sm transition-[background-color,transform] active:scale-[0.96] disabled:opacity-50"
                      >
                        Yalla, start review
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={learnNewWords}
                          disabled={loading}
                          className="rounded-full bg-green-600 hover:bg-green-700 text-white px-7 py-3 text-base font-medium shadow-sm transition-[background-color,transform] active:scale-[0.96] disabled:opacity-50"
                        >
                          Learn something new
                        </button>
                        <button
                          onClick={() => serveNext(undefined, { ahead: true })}
                          disabled={loading}
                          className="rounded-full bg-white border border-gray-200 text-heading hover:bg-gray-50 px-6 py-3 text-base font-medium shadow-sm transition-[background-color,transform] active:scale-[0.96] disabled:opacity-50"
                        >
                          Review ahead
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => sendMessage("I want to add some new words")}
                      disabled={loading}
                      className="rounded-full bg-white border border-gray-200 text-heading hover:bg-gray-50 px-6 py-3 text-base font-medium shadow-sm transition-[background-color,transform] active:scale-[0.96] disabled:opacity-50"
                    >
                      Add words
                    </button>
                  </motion.div>
                </motion.div>
              ) : (
                activeMessages.map((message, i) => (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16, transition: { duration: 0.18, ease: "easeOut" } }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    {renderMessage(message, activeStart + i, true)}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
            {(loading || checking || commentaryPending) && (
              <TypingIndicator label={checking ? "Checking your answer..." : undefined} />
            )}
          </div>
        </div>

        <div className="px-4 pb-5 pt-1 space-y-2.5">
          {/* The footer lives at the eye's resting point -- banner and chips
              fade in/out instead of popping inside an animated stage. */}
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="max-w-2xl mx-auto rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-2 flex items-center justify-between gap-3"
              >
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-700/70 hover:text-red-700">
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {chips.length > 0 && (
              <motion.div
                key="chips"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex gap-2 flex-wrap justify-center"
              >
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  onClick={chip.onClick}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium border shadow-sm transition-[background-color,border-color,color,transform] active:scale-[0.96]",
                    chip.primary
                      ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
                      : "bg-white border-gray-200 text-heading hover:bg-gray-50"
                  )}
                >
                  {chip.label}
                  {chip.kbd && (
                    <kbd
                      aria-hidden="true"
                      className={cn(
                        "ml-1.5 rounded px-1 font-mono text-[10px] font-normal",
                        chip.primary ? "bg-white/20 text-white/90" : "bg-gray-100 text-subtle"
                      )}
                    >
                      {chip.kbd}
                    </kbd>
                  )}
                </button>
              ))}
              </motion.div>
            )}
          </AnimatePresence>

          {attachedImage && (
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage}
                alt="Attached"
                className="h-12 w-12 rounded-lg object-cover border border-gray-200 shadow-sm"
              />
              <span className="text-xs text-subtle">
                Photo attached — send to extract vocabulary from it.
              </span>
              <button
                onClick={() => setAttachedImage(null)}
                aria-label="Remove photo"
                className="relative h-6 w-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-heading transition-colors before:absolute before:-inset-2 before:content-['']"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="max-w-2xl mx-auto flex items-end gap-2 rounded-2xl border border-gray-200 bg-white shadow-sm px-3 py-2 transition-[box-shadow,border-color] focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-500/20">
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
              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-[background-color,color,transform] active:scale-[0.96] disabled:opacity-40"
            >
              <ImagePlus className="h-[18px] w-[18px]" />
            </button>
            <Textarea
              ref={textareaRef}
              rows={1}
              aria-label="Message your tutor"
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
                  : reviewPending || verdictShowing
                  ? "Ask about this word..."
                  : placeholder
              }
              className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[30px] max-h-40 px-0 py-1.5 text-[15px] bg-transparent"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || checking || (!input.trim() && !attachedImage)}
              aria-label="Send"
              className="h-9 w-9 shrink-0 rounded-full bg-green-600 text-white flex items-center justify-center transition-[background-color,transform] active:scale-[0.96] hover:bg-green-700 disabled:opacity-35 disabled:hover:bg-green-600"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <aside className="hidden lg:flex w-72 shrink-0 border-l flex-col bg-gray-50/60">
        <ProgressPanel data={progressData} />
      </aside>
    </div>
    </MotionConfig>
  );
}
