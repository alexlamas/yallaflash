import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    return createSupabaseClient(url, key);
  }

  return createBrowserClient(url, key);
};
