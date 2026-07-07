import { createClient } from "@/utils/supabase/client";

// All V2 API calls go through here. On the website NEXT_PUBLIC_API_BASE is
// unset: paths stay relative and auth rides in cookies, exactly as before.
// The packaged native app (Capacitor) is a static export served from its own
// origin, so it sets NEXT_PUBLIC_API_BASE to the deployed site and sends the
// Supabase access token as a bearer header instead.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!API_BASE) return fetch(path, init);

  const headers = new Headers(init?.headers);
  const { data: { session } } = await createClient().auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

// JSON convenience wrapper: no body -> GET, body -> POST. Throws with the
// server's error message so callers can surface it directly.
export async function apiJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data && (data as { error?: unknown }).error;
    const message =
      typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : `Request to ${path} failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}
