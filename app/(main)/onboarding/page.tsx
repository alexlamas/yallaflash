"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "../../contexts/ProfileContext";
import { useAuth } from "../../contexts/AuthContext";
import { AVATAR_OPTIONS, FluencyLevel } from "../../services/profileService";
import { PackService, Pack } from "../../services/packService";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Star } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";

const FLUENCY_OPTIONS: {
  value: FluencyLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "beginner",
    label: "Beginner",
    description: "Just starting out",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "Know some basics",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Can have conversations",
  },
];

type PackWithCount = Pack & { wordCount: number };

export default function OnboardingPage() {
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { updateProfile, onboardingCompleted, isLoading: isProfileLoading } = useProfile();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("pomegranate");
  const [fluency, setFluency] = useState<FluencyLevel | null>(null);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [packs, setPacks] = useState<PackWithCount[]>([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect if already onboarded
  useEffect(() => {
    if (!isAuthLoading && !isProfileLoading && onboardingCompleted) {
      router.replace("/");
    }
  }, [isAuthLoading, isProfileLoading, onboardingCompleted, router]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthLoading && !session) {
      router.replace("/");
    }
  }, [isAuthLoading, session, router]);

  // Load packs when reaching step 4
  useEffect(() => {
    if (step === 4 && packs.length === 0) {
      loadPacks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, packs.length]);

  async function loadPacks() {
    setIsLoadingPacks(true);
    try {
      const [availablePacks, wordCounts] = await Promise.all([
        PackService.getAvailablePacks(),
        PackService.getPackWordCounts(),
      ]);

      const packsWithCounts = availablePacks.map((p) => ({
        ...p,
        wordCount: wordCounts[p.id] || 0,
      }));

      // Sort by fluency match
      packsWithCounts.sort((a, b) => {
        const aMatch = a.level === fluency;
        const bMatch = b.level === fluency;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });

      setPacks(packsWithCounts);
    } catch (error) {
      console.error("Failed to load packs:", error);
    } finally {
      setIsLoadingPacks(false);
    }
  }

  function togglePackSelection(packId: string) {
    setSelectedPacks(prev => {
      if (prev.includes(packId)) {
        return prev.filter(id => id !== packId);
      }
      if (prev.length >= 3) {
        return prev; // Already at max
      }
      return [...prev, packId];
    });
  }

  async function handleComplete() {
    if (selectedPacks.length === 0) return;

    setIsSaving(true);
    try {
      // Update profile and start packs
      await updateProfile({
        first_name: name.trim() || undefined,
        avatar,
        fluency: fluency || undefined,
        onboarding_completed: true,
      });

      await Promise.all(selectedPacks.map(packId => PackService.startPack(packId)));

      // Track onboarding completion
      posthog.capture("onboarding_completed", {
        fluency_level: fluency,
        packs_selected: selectedPacks.length,
      });

      // Use hard navigation to ensure clean state - this is the only reliable way
      // to avoid race conditions with React context updates
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setIsSaving(false);
    }
  }

  function canProceed() {
    switch (step) {
      case 1: return true;
      case 2: return true;
      case 3: return fluency !== null;
      case 4: return selectedPacks.length > 0;
      default: return false;
    }
  }

  function handleNext() {
    if (step < 4) {
      posthog.capture("onboarding_step_completed", {
        step,
        step_name: step === 1 ? "name" : step === 2 ? "avatar" : "fluency",
        provided_name: step === 1 ? name.trim().length > 0 : undefined,
        fluency_level: step === 3 ? fluency : undefined,
      });
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  if (isAuthLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session || onboardingCompleted) {
    return null;
  }

  const stepIndicator = (
    <div className="flex gap-1.5 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            s === step ? "bg-gray-900 w-6" : s < step ? "bg-gray-900 w-2" : "bg-gray-200 w-2"
          )}
        />
      ))}
    </div>
  );

  const nextButton = (
    <Button
      onClick={handleNext}
      disabled={!canProceed() || isSaving}
      size="lg"
      className="w-full h-14 text-base rounded-xl bg-gray-900 hover:bg-gray-800"
    >
      {isSaving ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : step === 4 ? (
        "Start learning"
      ) : (
        <>
          Continue
          <ArrowRight className="h-5 w-5 ml-2" />
        </>
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Yalla Flash" width={28} height={28} />
          <span className="font-semibold text-lg">Yalla Flash</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {/* Step 1: Name */}
            {step === 1 && (
              <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                {stepIndicator}
                <h1 className="text-3xl font-title text-gray-900 mb-2">
                  What&apos;s your name?
                </h1>
                <p className="text-gray-500 mb-8">
                  So we know what to call you
                </p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNext()}
                  placeholder="Enter your name"
                  className="text-lg h-14 rounded-xl mb-6"
                  autoFocus
                />
                {nextButton}
              </div>
            )}

            {/* Step 2: Avatar */}
            {step === 2 && (
              <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                {stepIndicator}
                <h1 className="text-3xl font-title text-gray-900 mb-2">
                  Pick an avatar
                </h1>
                <p className="text-gray-500 mb-8">
                  Choose one that represents you
                </p>
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {AVATAR_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setAvatar(option.id)}
                      className={cn(
                        "relative aspect-square rounded-2xl overflow-hidden transition-all duration-200",
                        avatar === option.id
                          ? "ring-4 ring-gray-900 ring-offset-2 scale-105"
                          : "hover:scale-105 opacity-60 hover:opacity-100"
                      )}
                    >
                      <Image
                        src={option.image}
                        alt={option.label}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
                {nextButton}
              </div>
            )}

            {/* Step 3: Fluency */}
            {step === 3 && (
              <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
                {stepIndicator}
                <h1 className="text-3xl font-title text-gray-900 mb-2">
                  Your Arabic level?
                </h1>
                <p className="text-gray-500 mb-8">
                  We&apos;ll recommend packs for you
                </p>
                <div className="space-y-3 mb-6">
                  {FLUENCY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFluency(option.value)}
                      className={cn(
                        "w-full p-4 rounded-2xl text-left transition-all duration-200 border-2",
                        fluency === option.value
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {option.label}
                          </div>
                          <div className="text-sm text-gray-500">
                            {option.description}
                          </div>
                        </div>
                        {fluency === option.value && (
                          <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {nextButton}
              </div>
            )}

            {/* Step 4: Pack Selection */}
            {step === 4 && (
              <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full py-4">
                {stepIndicator}
                <h1 className="text-3xl font-title text-gray-900 mb-2">
                  Choose your packs
                </h1>
                <p className="text-gray-500 mb-6">
                  Select up to 3 packs to start learning.
                </p>
                {isLoadingPacks ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-1 -m-1 mb-6">
                      {packs.slice(0, 6).map((pack) => {
                        const isRecommended = pack.level === fluency;
                        const isSelected = selectedPacks.includes(pack.id);
                        return (
                          <button
                            key={pack.id}
                            onClick={() => togglePackSelection(pack.id)}
                            className={cn(
                              "relative rounded-2xl overflow-hidden text-left transition-all duration-200 bg-white border-2 group",
                              isSelected
                                ? "border-gray-900 shadow-lg scale-[1.02]"
                                : "border-gray-100 hover:border-gray-300 hover:shadow-md"
                            )}
                          >
                            {/* Pack Image */}
                            <div className="aspect-square relative bg-gray-100">
                              {pack.image_url ? (
                                <Image
                                  src={pack.image_url}
                                  alt={pack.name}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl">
                                  📚
                                </div>
                              )}
                              {/* Recommended badge */}
                              {isRecommended && (
                                <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                                  <Star weight="fill" className="w-3 h-3" />
                                  For you
                                </div>
                              )}
                              {/* Selected checkmark */}
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>
                            {/* Pack Info */}
                            <div className="p-3">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {pack.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {pack.wordCount} words
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="max-w-md">
                      {nextButton}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
