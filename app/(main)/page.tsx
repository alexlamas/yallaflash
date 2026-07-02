"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useWords } from "../contexts/WordsContext";
import { useProfile } from "../contexts/ProfileContext";
import { LandingPage } from "../components/LandingPage";
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

  // Show landing page for non-authenticated users
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
