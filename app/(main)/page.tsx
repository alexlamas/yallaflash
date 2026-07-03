"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useWords } from "../contexts/WordsContext";
import { useProfile } from "../contexts/ProfileContext";
import { useUserRoles } from "../hooks/useUserRoles";
import { LandingV2 } from "@/app/v2/components/Landing";
import { Dashboard } from "../components/Dashboard";

function HomeContent() {
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isWordsLoading } = useWords();
  const { onboardingCompleted, isLoading: isProfileLoading } = useProfile();
  const { isAdmin, isLoading: isRolesLoading } = useUserRoles();

  // V2 chat onboarding is admin-gated while it bakes; everyone else keeps
  // the V1 wizard flow untouched.
  useEffect(() => {
    if (isAuthLoading || isProfileLoading || isRolesLoading) return;
    if (session && !onboardingCompleted) {
      router.replace(isAdmin ? "/chat" : "/onboarding");
    }
  }, [isAuthLoading, isProfileLoading, isRolesLoading, isAdmin, session, onboardingCompleted, router]);

  if (isAuthLoading || (session && isProfileLoading)) {
    return null;
  }

  // Show landing page for non-authenticated users. V2 memory-app positioning
  // supersedes the old course-style LandingPage (and its hero-copy A/B test).
  if (!session) {
    return <LandingV2 />;
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
