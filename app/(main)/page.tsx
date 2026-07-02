"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useWords } from "../contexts/WordsContext";
import { useProfile } from "../contexts/ProfileContext";
import { LandingV2 } from "@/app/v2/components/Landing";
import { Dashboard } from "../components/Dashboard";

function HomeContent() {
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { isLoading: isWordsLoading } = useWords();
  const { onboardingCompleted, isLoading: isProfileLoading } = useProfile();

  // New users go straight to the chat tutor -- its onboarding widget replaces
  // the old multi-step wizard (which still exists at /onboarding for now).
  useEffect(() => {
    if (!isAuthLoading && !isProfileLoading && session && !onboardingCompleted) {
      router.replace("/chat");
    }
  }, [isAuthLoading, isProfileLoading, session, onboardingCompleted, router]);

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
