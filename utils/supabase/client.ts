import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// createBrowserClient is a singleton internally; supabase-js is NOT. The app
// calls createClient() per operation, so the native client must be cached or
// every call spawns another GoTrueClient racing the rest for the same
// localStorage session (auth-event storms, thrashed boot).
let nativeClient: SupabaseClient | null = null;

export const createClient = () => {
  // During build time, environment variables may not be available
  // Use placeholder values to prevent build errors (client won't actually be used during static generation)
  const url = supabaseUrl || "https://placeholder.supabase.co";
  const key = supabaseKey || "placeholder-key";

  // The native app (Capacitor) has no server reading cookies, and WKWebView
  // cookie persistence on the capacitor:// scheme is unreliable -- keep the
  // session in localStorage there instead. The website keeps the cookie-based
  // client so server components and API routes see the session.
  if (process.env.NEXT_PUBLIC_APP_MODE === "native") {
    if (!nativeClient) {
      nativeClient = createSupabaseClient(url, key);
    }
    return nativeClient;
  }

  return createBrowserClient(url, key);
};
