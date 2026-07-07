"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { hasV2Access } from "@/app/v2/lib/access";
import { hideSplash } from "@/app/v2/lib/native";

// Client-side replacement for the server-side cookies()+redirect gate the V2
// pages used to have. Runs on the browser session, so the same pages work in
// the static-export native build where there is no server to gate them.
export function V2Gate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");
  // In the native app "/" redirects signed-in users here, so bouncing a
  // non-enabled account back would loop -- show a notice instead.
  const isNativeApp = process.env.NEXT_PUBLIC_APP_MODE === "native";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const ok = !!user && (await hasV2Access(supabase, user.id));
      if (cancelled) return;
      if (ok) {
        setState("allowed");
      } else if (isNativeApp && user) {
        setState("denied");
      } else {
        router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, isNativeApp]);

  // Whatever the verdict renders (chat or the notice), the boot is over.
  useEffect(() => {
    if (state !== "checking") hideSplash();
  }, [state]);

  if (state === "denied") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-sm text-gray-500">
        This account doesn&apos;t have access to the tutor yet.
      </div>
    );
  }
  if (state !== "allowed") return null;
  return <>{children}</>;
}
