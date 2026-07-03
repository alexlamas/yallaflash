"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Lock, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The editable database view over everything the user is learning.
// Word fields edit inline for custom words (pack words are shared and
// locked, but the per-user note is always editable).

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

export function WordsTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    post<{ rows: Row[] }>("/api/v2/words/list", {})
      .then((data) => setRows(data.rows))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load words."));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.arabizi, r.english, r.script ?? "", r.type ?? "", r.user_note ?? ""].some((v) =>
        v.toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

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
    // Required fields can't be blanked.
    if ((field === "arabizi" || field === "english") && !value) return;

    // Optimistic update; revert on failure.
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

  async function deleteSelected() {
    if (!rows || selected.size === 0) return;
    const ids = [...selected];
    const prevRows = rows;
    setRows(rows.filter((r) => !selected.has(r.word_id)));
    setSelected(new Set());
    try {
      await post("/api/v2/words/delete", { wordIds: ids });
    } catch (err) {
      setRows(prevRows);
      setError(err instanceof Error ? err.message : "Couldn't remove those words.");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.word_id));

  function renderCell(row: Row, field: EditableField, className?: string) {
    const isEditing = editing?.id === row.word_id && editing.field === field;
    const raw = field === "user_note" ? row.user_note : (row[field] as string | null);
    const editable = field === "user_note" || row.owned;
    if (isEditing) {
      return (
        <input
          autoFocus
          value={draft}
          dir={field === "script" ? "rtl" : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(null);
          }}
          className="w-full rounded border border-green-400 bg-white px-1.5 py-0.5 text-sm outline-none"
        />
      );
    }
    return (
      <button
        onClick={() => beginEdit(row, field)}
        className={cn(
          "w-full truncate rounded px-1.5 py-0.5 text-left",
          editable ? "hover:bg-green-50 cursor-text" : "cursor-default",
          !raw && "text-gray-300",
          className
        )}
        title={editable ? "Click to edit" : "Pack word -- shared, not editable"}
      >
        {raw || "--"}
      </button>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-green-50/60 via-white to-white">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href="/chat"
            aria-label="Back to chat"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-heading"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Image src="/logo.svg" alt="" width={22} height={22} />
          <h1 className="font-title text-xl">My words</h1>
          <span className="text-sm text-subtle">{rows ? `${rows.length}` : "..."}</span>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search words..."
              className="w-full rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-green-400"
            />
          </div>
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove {selected.size}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-4">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-subtle">
              <th className="w-8 border-b border-gray-200 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() =>
                    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.word_id)))
                  }
                />
              </th>
              <th className="border-b border-gray-200 px-2 py-2">Arabizi</th>
              <th className="border-b border-gray-200 px-2 py-2">Script</th>
              <th className="border-b border-gray-200 px-2 py-2">English</th>
              <th className="border-b border-gray-200 px-2 py-2">Type</th>
              <th className="border-b border-gray-200 px-2 py-2">Note</th>
              <th className="border-b border-gray-200 px-2 py-2">Status</th>
              <th className="border-b border-gray-200 px-2 py-2">Next</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={8} className="px-2 py-10 text-center text-subtle">
                  Loading your words...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-10 text-center text-subtle">
                  {search ? "No words match that search." : "Nothing here yet -- add words in the chat."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const due = dueLabel(row.next_review_date);
                return (
                  <tr key={row.word_id} className={cn("group", selected.has(row.word_id) && "bg-green-50/60")}>
                    <td className="border-b border-gray-100 px-2 py-1.5 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(row.word_id)}
                        onChange={() => toggle(row.word_id)}
                      />
                    </td>
                    <td className="border-b border-gray-100 px-1 py-1.5 font-medium">
                      <div className="flex items-center gap-1">
                        {renderCell(row, "arabizi")}
                        {!row.owned && <Lock className="h-3 w-3 shrink-0 text-gray-300" />}
                      </div>
                    </td>
                    <td dir="rtl" className="border-b border-gray-100 px-1 py-1.5">
                      {renderCell(row, "script")}
                    </td>
                    <td className="border-b border-gray-100 px-1 py-1.5 text-stone-600">
                      {renderCell(row, "english")}
                    </td>
                    <td className="border-b border-gray-100 px-1 py-1.5 text-subtle">
                      {renderCell(row, "type")}
                    </td>
                    <td className="max-w-[220px] border-b border-gray-100 px-1 py-1.5 text-subtle">
                      {renderCell(row, "user_note")}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          row.status === "learned"
                            ? "bg-green-100 text-green-800"
                            : row.status === "learning"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "border-b border-gray-100 px-2 py-1.5 font-mono text-[12px]",
                        due.due ? "font-semibold text-red-600" : "text-subtle"
                      )}
                    >
                      {due.label}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
