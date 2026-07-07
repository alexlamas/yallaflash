"use client";

// Figma-style feedback overlay for the design lab. Click "Add feedback",
// click any element inside a variant, type a note. "Submit all" formats
// everything as markdown and copies it to the clipboard to paste back into
// the Claude session. Self-contained on purpose — deleted with the lab.

import { useCallback, useEffect, useRef, useState } from "react";

interface Comment {
  id: number;
  variant: string;
  selector: string;
  description: string;
  text: string;
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return text ? `${tag} with "${text}"` : tag;
}

function selectorFor(el: Element): string {
  if (el.id) return `#${el.id}`;
  const testId = el.getAttribute("data-testid");
  if (testId) return `[data-testid='${testId}']`;
  const cls = Array.from(el.classList)
    .filter((c) => !c.startsWith("hover:") && !c.startsWith("focus"))
    .slice(0, 2)
    .join(".");
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
}

export function FeedbackOverlay({ targetName }: { targetName: string }) {
  const [picking, setPicking] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [direction, setDirection] = useState("");
  const [draft, setDraft] = useState<{ variant: string; selector: string; description: string } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const nextId = useRef(1);
  const hovered = useRef<HTMLElement | null>(null);

  const clearHighlight = useCallback(() => {
    if (hovered.current) {
      hovered.current.style.outline = "";
      hovered.current.style.outlineOffset = "";
      hovered.current = null;
    }
  }, []);

  useEffect(() => {
    if (!picking) return;

    const onMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-feedback-ui]") || !el.closest("[data-variant]")) {
        clearHighlight();
        return;
      }
      if (hovered.current !== el) {
        clearHighlight();
        hovered.current = el;
        el.style.outline = "2px solid #7c3aed";
        el.style.outlineOffset = "2px";
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-feedback-ui]")) return;
      const variantEl = el.closest("[data-variant]");
      if (!variantEl) return;
      e.preventDefault();
      e.stopPropagation();
      setDraft({
        variant: variantEl.getAttribute("data-variant") ?? "?",
        selector: selectorFor(el),
        description: describeElement(el),
      });
      setDraftText("");
      setPicking(false);
      clearHighlight();
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      clearHighlight();
    };
  }, [picking, clearHighlight]);

  const saveDraft = () => {
    if (!draft || !draftText.trim()) return;
    setComments((c) => [...c, { id: nextId.current++, ...draft, text: draftText.trim() }]);
    setDraft(null);
    setDraftText("");
    setPanelOpen(true);
  };

  const submit = async () => {
    const byVariant = new Map<string, Comment[]>();
    for (const c of comments) {
      byVariant.set(c.variant, [...(byVariant.get(c.variant) ?? []), c]);
    }
    let md = `## Design Lab Feedback\n\n**Target:** ${targetName}\n**Comments:** ${comments.length}\n`;
    for (const [variant, list] of [...byVariant.entries()].sort()) {
      md += `\n### Variant ${variant}\n`;
      list.forEach((c, i) => {
        md += `${i + 1}. **Element** (\`${c.selector}\`, ${c.description})\n   "${c.text}"\n`;
      });
    }
    md += `\n### Overall Direction\n${direction.trim() || "(not specified)"}\n`;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked — show the text so it can be copied manually
      window.prompt("Copy this feedback:", md);
    }
  };

  return (
    <div data-feedback-ui="true">
      {/* picking hint */}
      {picking && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] rounded-full bg-violet-600 text-white text-xs font-medium px-4 py-2 shadow-lg">
          Click any element inside a variant to comment — Esc to cancel
        </div>
      )}

      {/* comment draft dialog */}
      {draft && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-4">
            <div className="text-xs text-gray-500">
              Variant {draft.variant} · <code className="text-[11px]">{draft.selector}</code>
            </div>
            <div className="text-sm font-medium text-gray-900 mt-0.5">{draft.description}</div>
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveDraft();
                if (e.key === "Escape") setDraft(null);
              }}
              placeholder="What should change here?"
              rows={3}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="px-3 py-1.5 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={saveDraft}
                disabled={!draftText.trim()}
                className="px-3 py-1.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* panel */}
      {panelOpen && (
        <div className="fixed bottom-20 right-4 z-[60] w-[340px] max-h-[60vh] flex flex-col rounded-xl bg-white border border-gray-200 shadow-2xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Feedback ({comments.length})</span>
            <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {comments.length === 0 && <p className="text-xs text-gray-500 py-2">No comments yet — use “Add feedback”.</p>}
            {comments.map((c) => (
              <div key={c.id} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-violet-600">Variant {c.variant} · {c.description}</span>
                  <button
                    onClick={() => setComments((cs) => cs.filter((x) => x.id !== c.id))}
                    className="text-gray-300 hover:text-red-500 text-xs"
                    aria-label="Delete comment"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-800 mt-0.5">{c.text}</p>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <textarea
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Overall direction (required) — e.g. 'B's forest + A's recovery plan'"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={submit}
              disabled={!direction.trim() && comments.length === 0}
              className="mt-2 w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40"
            >
              {copied ? "✓ Copied — paste it to Claude" : "Submit all feedback (copies to clipboard)"}
            </button>
          </div>
        </div>
      )}

      {/* launcher buttons */}
      <div className="fixed bottom-4 right-4 z-[60] flex gap-2">
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="rounded-full bg-white border border-gray-200 shadow-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          💬 {comments.length}
        </button>
        <button
          onClick={() => setPicking((p) => !p)}
          className={`rounded-full shadow-lg px-4 py-2.5 text-sm font-semibold ${
            picking ? "bg-violet-100 text-violet-700 border border-violet-300" : "bg-violet-600 text-white hover:bg-violet-700"
          }`}
        >
          {picking ? "Cancel" : "＋ Add feedback"}
        </button>
      </div>
    </div>
  );
}
