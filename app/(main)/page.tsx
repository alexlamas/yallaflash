"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useWords } from "../contexts/WordsContext";
import { useProfile } from "../contexts/ProfileContext";
import { useUserRoles } from "../hooks/useUserRoles";
import { LandingPage } from "../components/LandingPage";
import { Dashboard } from "../components/Dashboard";

function HomeContent() {
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isWordsLoading } = useWords();
  const { onboardingCompleted, isLoading: isProfileLoading } = useProfile();
  const { isAdmin, isLoading: isRolesLoading } = useUserRoles();

  // The packaged native app is the V2 chat experience: any signed-in user
  // lands on /chat (V2Gate shows a no-access notice there if the account
  // isn't enabled, rather than bouncing back here).
  const isNativeApp = process.env.NEXT_PUBLIC_APP_MODE === "native";
  useEffect(() => {
    if (!isNativeApp || isAuthLoading) return;
    if (session) router.replace("/chat");
  }, [isNativeApp, isAuthLoading, session, router]);

  // V2 chat onboarding is admin-gated while it bakes; everyone else keeps
  // the V1 wizard flow untouched.
  useEffect(() => {
    if (isNativeApp) return;
    if (isAuthLoading || isProfileLoading || isRolesLoading) return;
    if (session && !onboardingCompleted) {
      router.replace(isAdmin ? "/chat" : "/onboarding");
    }
  }, [isNativeApp, isAuthLoading, isProfileLoading, isRolesLoading, isAdmin, session, onboardingCompleted, router]);

  if (isAuthLoading || (session && isProfileLoading)) {
    return null;
  }

  // Show landing page for non-authenticated users. The V1 landing (and its
  // hero-copy A/B test) stays live for the public while V2 bakes behind the
  // admin gate; the V2 landing lives in app/v2/components/Landing.tsx,
  // unwired, for when it's time.
  if (!session) {
    return <LandingPage />;
  }

  // Redirect to onboarding if not completed (don't render anything while redirecting)
  if (!onboardingCompleted) {
    return null;
  }

  // Show loading for authenticated users while words are loading
  if (isWordsLoading) {
    return null;
  }

  return <Dashboard />;
}

export default function Home() {
  return <HomeContent />;
}
