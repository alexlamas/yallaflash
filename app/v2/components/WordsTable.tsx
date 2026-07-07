"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarClock,
  Check,
  Lock,
  MoreHorizontal,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Linear-grade database view over everything the user is learning:
// keyboard-first (arrows, x, enter, /), hover-revealed row actions,
// floating selection bar, sortable columns, filter chips.

type Row = {
  word_id: string;
  arabizi: string;
  script: string | null;
  english: string;
  type: string | null;
  memory_hook: string | null;
  word_notes: string | null;
  user_note: string | null;
  owned: boolean;
  status: string;
  interval: number;
  review_count: number;
  next_review_date: string;
};

type EditableField = "arabizi" | "script" | "english" | "type" | "user_note";
type SortKey = "arabizi" | "status" | "next_review_date";
type Filter = "all" | "due" | "learning" | "learned" | "new";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data && (data as { error?: unknown }).error;
    throw new Error(typeof raw === "string" ? raw : `Request failed (${res.status})`);
  }
  return data as T;
}

function dueLabel(iso: string): { label: string; due: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "due now", due: true };
  const hours = Math.round(ms / 3600_000);
  if (hours < 1) return { label: `~${Math.max(1, Math.round(ms / 60000))}m`, due: false };
  if (hours < 48) return { label: `~${hours}h`, due: false };
  return { label: `~${Math.round(hours / 24)}d`, due: false };
}

const STATUS_BADGE: Record<string, string> = {
  learned: "bg-green-100 text-green-800 hover:bg-green-100",
  learning: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  new: "bg-gray-100 text-gray-600 hover:bg-gray-100",
};

export function WordsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "next_review_date", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastClicked = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    post<{ rows: Row[] }>("/api/v2/words/list", {})
      .then((data) => setRows(data.rows))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load words."));
  }, []);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, due: 0, learning: 0, learned: 0, new: 0 };
    for (const r of rows ?? []) {
      if (new Date(r.next_review_date).getTime() <= Date.now()) c.due++;
      if (r.status === "learning") c.learning++;
      else if (r.status === "learned") c.learned++;
      else c.new++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    let out = rows;
    if (filter === "due") out = out.filter((r) => new Date(r.next_review_date).getTime() <= Date.now());
    else if (filter !== "all") out = out.filter((r) => r.status === filter);
    if (q) {
      out = out.filter((r) =>
        [r.arabizi, r.english, r.script ?? "", r.type ?? "", r.user_note ?? ""].some((v) =>
          v.toLowerCase().includes(q)
        )
      );
    }
    const dir = sort.dir;
    return [...out].sort((a, b) => {
      if (sort.key === "next_review_date") {
        return (new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime()) * dir;
      }
      return String(a[sort.key]).localeCompare(String(b[sort.key])) * dir;
    });
  }, [rows, search, filter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  function toggleSelect(id: string, shiftKey = false) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked.current) {
        const ids = filtered.map((r) => r.word_id);
        const a = ids.indexOf(lastClicked.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(ids[i]);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastClicked.current = id;
      return next;
    });
  }

  function beginEdit(row: Row, field: EditableField) {
    if (field !== "user_note" && !row.owned) return;
    setEditing({ id: row.word_id, field });
    setDraft(field === "user_note" ? row.user_note ?? "" : (row[field] as string | null) ?? "");
  }

  async function commitEdit() {
    if (!editing || !rows) return;
    const { id, field } = editing;
    const row = rows.find((r) => r.word_id === id);
    setEditing(null);
    if (!row) return;
    const value = draft.trim();
    const current = field === "user_note" ? row.user_note ?? "" : ((row[field] as string | null) ?? "");
    if (value === current.trim()) return;
    if ((field === "arabizi" || field === "english") && !value) return;

    const prevRows = rows;
    setRows(
      rows.map((r) =>
        r.word_id === id ? { ...r, [field === "user_note" ? "user_note" : field]: value || null } : r
      )
    );
    try {
      await post("/api/v2/words/update", {
        wordId: id,
        ...(field === "user_note" ? { userNote: value || null } : { fields: { [field]: value } }),
      });
    } catch (err) {
      setRows(prevRows);
      setError(err instanceof Error ? err.message : "Couldn't save that edit.");
    }
  }

  const removeRows = useCallback(
    async (ids: string[]) => {
      if (!rows || ids.length === 0) return;
      // Guards every delete path (keyboard, row menu, selection bar) -- no undo exists.
      const label = ids.length === 1 ? "1 word" : `${ids.length} words`;
      if (!window.confirm(`Remove ${label}? This can't be undone.`)) return;
      const prevRows = rows;
      setRows(rows.filter((r) => !ids.includes(r.word_id)));
      setSelected(new Set());
      try {
        await post("/api/v2/words/delete", { wordIds: ids });
      } catch (err) {
        setRows(prevRows);
        setError(err instanceof Error ? err.message : "Couldn't remove those words.");
      }
    },
    [rows]
  );

  async function reschedule(id: string, hours: number) {
    if (!rows) return;
    const next = new Date(Date.now() + hours * 3600_000).toISOString();
    const prevRows = rows;
    setRows(rows.map((r) => (r.word_id === id ? { ...r, next_review_date: next } : r)));
    try {
      await post("/api/v2/words/update", { wordId: id, nextReviewHours: hours });
    } catch (err) {
      setRows(prevRows);
      setError(err instanceof Error ? err.message : "Couldn't reschedule.");
    }
  }

  // Linear-style keyboard model: arrows move, x selects, enter edits,
  // / searches, esc unwinds (edit -> selection -> active row).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (event.key === "Escape") {
        if (typing) return; // inputs handle their own escape
        if (selected.size > 0) setSelected(new Set());
        else setActive(null);
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const ids = filtered.map((r) => r.word_id);
      if (ids.length === 0) return;
      const idx = active ? ids.indexOf(active) : -1;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setActive(ids[Math.min(idx + 1, ids.length - 1)]);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setActive(ids[Math.max(idx - 1, 0)]);
      } else if (event.key.toLowerCase() === "x" && active) {
        toggleSelect(active);
      } else if (event.key === "Enter" && active) {
        const row = filtered.find((r) => r.word_id === active);
        if (row) beginEdit(row, row.owned ? "arabizi" : "user_note");
      } else if ((event.key === "Backspace" || event.key === "Delete") && selected.size > 0) {
        event.preventDefault();
        removeRows([...selected]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, active, selected, removeRows]);

  function renderCell(row: Row, field: EditableField, rtl = false) {
    const isEditing = editing?.id === row.word_id && editing.field === field;
    const raw = field === "user_note" ? row.user_note : (row[field] as string | null);
    const editable = field === "user_note" || row.owned;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={draft}
          dir={rtl ? "rtl" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(null);
          }}
          className="w-full rounded-md border border-green-500 bg-white px-1.5 py-0.5 text-sm outline-none ring-2 ring-green-500/20"
        />
      );
    }
    return (
      <button
        onClick={() => beginEdit(row, field)}
        tabIndex={-1}
        className={cn(
          "w-full truncate rounded-md px-1.5 py-0.5 text-left",
          editable && "hover:bg-black/[0.04]",
          !raw && "text-gray-300"
        )}
        title={editable ? undefined : "Pack word — shared, not editable"}
      >
        {raw || "—"}
      </button>
    );
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "due", label: "Due" },
    { key: "learning", label: "Learning" },
    { key: "learned", label: "Learned" },
    { key: "new", label: "New" },
  ];

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link
            href="/chat"
            aria-label="Back to chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-heading"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Image src="/logo.svg" alt="" width={20} height={20} />
          <h1 className="font-title text-lg">My words</h1>
          <div className="ml-2 flex flex-wrap items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors",
                  filter === f.key ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {f.label}
                <span className={cn("ml-1.5 tabular-nums", filter === f.key ? "text-gray-300" : "text-gray-400")}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full max-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (e.target as HTMLInputElement).blur()}
              placeholder="Search  /"
              className="h-8 border-gray-200 pl-8 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-green-500/40"
            />
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="mx-auto max-w-6xl overflow-x-auto px-4 pb-24 pt-2">
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>
                <button onClick={() => toggleSort("arabizi")} className="flex items-center gap-1 hover:text-heading">
                  Arabizi <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Script</TableHead>
              <TableHead>English</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>
                <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-heading">
                  Status <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("next_review_date")}
                  className="flex items-center gap-1 hover:text-heading"
                >
                  Next <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9} className="py-2.5">
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-subtle">
                  {search || filter !== "all" ? "Nothing matches." : "Nothing here yet — add words in the chat."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const due = dueLabel(row.next_review_date);
                const isSelected = selected.has(row.word_id);
                const isActive = active === row.word_id;
                return (
                  <TableRow
                    key={row.word_id}
                    onMouseEnter={() => setActive(row.word_id)}
                    className={cn(
                      "group",
                      isSelected && "bg-green-50/70 hover:bg-green-50/70",
                      isActive && !isSelected && "bg-gray-50"
                    )}
                  >
                    <TableCell className="py-1.5 pr-0">
                      <button
                        onClick={(e) => toggleSelect(row.word_id, e.shiftKey)}
                        aria-label="Select row"
                        className={cn(
                          "flex h-4.5 w-4.5 items-center justify-center rounded-full border transition-opacity",
                          isSelected
                            ? "border-green-600 bg-green-600 text-white opacity-100"
                            : "border-gray-300 bg-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        )}
                        style={{ height: 18, width: 18 }}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    </TableCell>
                    <TableCell className="py-1.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        {renderCell(row, "arabizi")}
                        {!row.owned && <Lock className="h-3 w-3 shrink-0 text-gray-300" />}
                      </div>
                    </TableCell>
                    <TableCell dir="rtl" className="py-1.5">
                      {renderCell(row, "script", true)}
                    </TableCell>
                    <TableCell className="py-1.5 text-stone-600">{renderCell(row, "english")}</TableCell>
                    <TableCell className="py-1.5 text-subtle">{renderCell(row, "type")}</TableCell>
                    <TableCell className="max-w-[200px] py-1.5 text-subtle">
                      {renderCell(row, "user_note")}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="secondary" className={cn("font-normal", STATUS_BADGE[row.status])}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "py-1.5 font-mono text-[12px]",
                        due.due ? "font-semibold text-red-600" : "text-subtle"
                      )}
                    >
                      {due.label}
                    </TableCell>
                    <TableCell className="py-1.5 pl-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label="Row actions"
                            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-100 transition-opacity hover:bg-gray-100 hover:text-heading sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => reschedule(row.word_id, 0)} className="gap-2">
                            <Zap className="h-4 w-4 text-gray-500" /> Review now
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => reschedule(row.word_id, 24)} className="gap-2">
                            <CalendarClock className="h-4 w-4 text-gray-500" /> Tomorrow
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => reschedule(row.word_id, 24 * 7)} className="gap-2">
                            <CalendarClock className="h-4 w-4 text-gray-500" /> Next week
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => removeRows([row.word_id])}
                            className="gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Floating selection bar, Linear-style */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-900 py-2 pl-5 pr-2 text-sm text-white shadow-xl">
          <span className="tabular-nums">{selected.size} selected</span>
          <Button
            size="sm"
            onClick={() => removeRows([...selected])}
            className="h-7 rounded-full bg-red-600 px-3 text-xs hover:bg-red-500"
          >
            <Trash2 className="mr-1 h-3 w-3" /> Remove
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-full px-2 py-1 text-xs text-gray-300 hover:text-white"
          >
            Esc
          </button>
        </div>
      )}
    </div>
  );
}
