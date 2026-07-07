"use client";

import { TopNav } from "../components/TopNav";
import { AuthProvider } from "../providers/AuthProvider";
import { WordsProvider } from "../providers/WordsProvider";
import { ProfileProvider } from "../contexts/ProfileContext";
import { OfflineIndicator } from "../components/OfflineIndicator";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import { AuthDialog } from "../components/AuthDialog";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "../contexts/AuthContext";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect to landing page if not authenticated and not already there
    if (!isLoading && !session && pathname !== "/") {
      router.push("/");
    }
  }, [session, isLoading, pathname, router]);

  // Show nothing while checking auth
  if (isLoading) {
    return null;
  }

  // Only show sidebar for authenticated users
  if (!session) {
    return (
      <>
        <ServiceWorkerRegistration />
        {children}
        <OfflineIndicator />
        <AuthDialog />
      </>
    );
  }

  // Immersive pages render fullscreen without the top nav. /words is part
  // of the V2 shell and brings its own header. The native static export
  // serves trailing-slash routes ("/chat/"), so normalize before matching.
  const path = pathname.replace(/\/+$/, "") || "/";
  const isImmersive =
    path === "/onboarding" || path === "/chat" || path === "/words" || path === "/coaching";

  return (
    <>
      <ServiceWorkerRegistration />
      {!isImmersive && <TopNav />}
      <main className={isImmersive ? "" : "pt-16"}>{children}</main>
      <OfflineIndicator />
    </>
  );
}

export default function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <WordsProvider>
          <AuthenticatedLayout>{children}</AuthenticatedLayout>
          <Toaster />
        </WordsProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
