"use client";

import { useState, useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  PlayCircle,
  X,
  Star,
  CaretDown,
} from "@phosphor-icons/react";
import Script from "next/script";
import { PublicFooter } from "./PublicFooter";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { StarterPackService, StarterPack, PackWord } from "../services/starterPackService";
import { hideSplash } from "@/app/v2/lib/native";
import { useFeatureFlagEnabled } from "posthog-js/react";
import posthog from "posthog-js";

export function LandingPage() {
  const { showAuthDialog, setShowAuthDialog } = useAuth();
  const [packs, setPacks] = useState<StarterPack[]>([]);
  const [packWordCounts, setPackWordCounts] = useState<Record<string, number>>({});
  const [selectedPack, setSelectedPack] = useState<StarterPack | null>(null);
  const [previewWords, setPreviewWords] = useState<PackWord[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // A/B test: hero copy variant
  const isVariantB = useFeatureFlagEnabled("hero-copy-test-exp");

  // Track CTA clicks for conversion funnel
  const handleCtaClick = (location: string) => {
    posthog.capture("signup_cta_clicked", { location });
    setShowAuthDialog(true);
  };

  // Sample demoCards for demo
  const demoCards = [
    { arabic: "حبيبي", english: "my love", transliteration: "habibi" },
    { arabic: "عيب", english: "shameful", transliteration: "3ayb" },
    { arabic: "كتير", english: "very", transliteration: "ktir" },
  ];

  // How it works interactive state
  const [activeStep, setActiveStep] = useState(1);
  const [isHowItWorksPaused, setIsHowItWorksPaused] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const isHowItWorksInView = useInView(howItWorksRef, { once: false, amount: 0.3 });
  const [showFeedback, setShowFeedback] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [showChevron, setShowChevron] = useState(false);

  // Delay chevron appearance until after carousel
  useEffect(() => {
    const timer = setTimeout(() => setShowChevron(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Signed-out native boot lands here; the splash waits for a real screen.
  useEffect(() => {
    hideSplash();
  }, []);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const hasCarouselStarted = useRef(false);

  // Auto-scroll carousel
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || isCarouselPaused || showAuthDialog || packs.length === 0) return;

    const scrollSpeed = 0.5; // pixels per frame
    let animationId: number;

    const scroll = () => {
      if (carousel.scrollLeft >= carousel.scrollWidth - carousel.clientWidth) {
        carousel.scrollLeft = 0; // Reset to start
      } else {
        carousel.scrollLeft += scrollSpeed;
      }
      animationId = requestAnimationFrame(scroll);
    };

    // Only delay on first start, resume immediately after hover
    if (!hasCarouselStarted.current) {
      const timeout = setTimeout(() => {
        hasCarouselStarted.current = true;
        animationId = requestAnimationFrame(scroll);
      }, 2000);
      return () => {
        clearTimeout(timeout);
        cancelAnimationFrame(animationId);
      };
    } else {
      animationId = requestAnimationFrame(scroll);
      return () => cancelAnimationFrame(animationId);
    }
  }, [isCarouselPaused, showAuthDialog, packs.length]);

  // Track scroll to hide chevron
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Show feedback overlay after step 3 loads
  useEffect(() => {
    if (activeStep === 3) {
      setShowFeedback(false);
      const feedbackTimer = setTimeout(() => setShowFeedback(true), 1000);
      return () => clearTimeout(feedbackTimer);
    } else {
      setShowFeedback(false);
    }
  }, [activeStep]);

  // Timer progress for the vertical line
  useEffect(() => {
    if (isHowItWorksPaused || !isHowItWorksInView) return;

    setTimerProgress(0);
    const duration = 4000; // matches auto-advance interval
    const interval = 50; // update every 50ms for smooth animation
    const increment = interval / duration;

    const timer = setInterval(() => {
      setTimerProgress(prev => {
        if (prev >= 1) return 0;
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeStep, isHowItWorksPaused, isHowItWorksInView]);

  // Load packs
  useEffect(() => {
    async function loadPacks() {
      try {
        const [availablePacks, wordCounts] = await Promise.all([
          StarterPackService.getAvailablePacks(),
          StarterPackService.getPackWordCounts(),
        ]);
        setPacks(availablePacks);
        setPackWordCounts(wordCounts);
      } catch {
      }
    }
    loadPacks();
  }, []);

  // Auto-advance "How it works" steps
  useEffect(() => {
    if (isHowItWorksPaused || !isHowItWorksInView) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev % 3) + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [isHowItWorksPaused, isHowItWorksInView]);

  // Load preview words when pack is selected
  const handlePackClick = async (pack: StarterPack) => {
    setPreviewWords([]); // Clear old words immediately
    setLoadingPreview(true);
    setSelectedPack(pack);
    try {
      const { words } = await StarterPackService.getPackContents(pack.id);
      setPreviewWords(words.slice(0, 6)); // Show first 6 words
    } catch {
    } finally {
      setLoadingPreview(false);
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How long does it take to learn Lebanese Arabic?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "With consistent daily practice of 10-15 minutes using spaced repetition, you can learn 300-500 common Lebanese Arabic words in 2-3 months. This covers most everyday conversations. Fluency takes longer, but you'll start understanding and speaking basic Lebanese Arabic within weeks.",
        },
      },
      {
        "@type": "Question",
        name: "Is Lebanese Arabic different from Modern Standard Arabic?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, Lebanese Arabic (Ammiya) is quite different from Modern Standard Arabic (MSA). Lebanese Arabic is the spoken dialect used in daily life in Lebanon, with simpler grammar, different pronunciation, and many borrowed words from French, Turkish, and Aramaic. MSA is used in formal writing and news broadcasts but isn't spoken naturally.",
        },
      },
      {
        "@type": "Question",
        name: "Can I learn Lebanese Arabic online for free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Yalla Flash offers free Lebanese Arabic flashcards with spaced repetition to help you learn vocabulary efficiently. You can start with essential phrases and common words, then progress to more advanced vocabulary packs.",
        },
      },
      {
        "@type": "Question",
        name: "What are the most important Lebanese Arabic phrases to learn first?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Start with greetings (Marhaba, Kifak/Kifik), thank you (Merci, Shukran), yes/no (Eh, La2), and common expressions like Yalla (let's go), Habibi (my dear), and Inshallah (God willing). These phrases are used constantly in Lebanese conversations.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Simple nav */}
      {/* top offset clears the notch in the native app / notched Safari
          (safe-area-inset is 0 elsewhere) */}
      <nav className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
        <div className="h-12 flex items-center bg-white border border-gray-200 rounded-full shadow-sm px-4 pr-1.5 gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/avatars/pomegranate.svg"
              alt="Yalla Flash"
              width={28}
              height={28}
            />
            <span className="font-pphatton font-bold text-lg text-heading">
              Yalla<span className="hidden sm:inline"> Flash</span>
            </span>
          </Link>

          <div className="flex-1" />

          <Button
            onClick={() => handleCtaClick("nav_login")}
            className="rounded-full"
            variant={"ghost"}
          >
            Log in
          </Button>
          <Button
            onClick={() => handleCtaClick("nav_get_started")}
            className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-5 text-sm font-medium"
          >
            Get started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="font-pphatton text-4xl sm:text-5xl md:text-6xl font-bold text-heading mb-5 tracking-tight"
          >
            {isVariantB ? "Lebanese Arabic flashcards" : "Learn Lebanese Arabic"}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl text-body mb-4 max-w-lg mx-auto"
          >
            {isVariantB
              ? "AI translations. Spaced repetition. Ready-made packs. The memory app for serious learners."
              : "Smart flashcards to help you finally understand what Teta is saying about you."}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm text-disabled mb-10"
          >
            Real spoken Lebanese — not MSA or &ldquo;Levantine&rdquo;.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Button
              size="lg"
              onClick={() => handleCtaClick("hero")}
              className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-8 pl-5 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <PlayCircle className="!size-6" weight="fill" />
              Start learning for free
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Edge-to-edge Packs Carousel */}
      <section className="py-8 overflow-hidden min-h-[320px] sm:min-h-[340px]">
        <motion.div
          ref={carouselRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onTouchStart={() => setIsCarouselPaused(true)}
          onTouchEnd={() => setIsCarouselPaused(false)}
        >
          {packs.slice(0, 20).map((pack, index) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.03, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handlePackClick(pack)}
              className="flex-shrink-0 snap-start cursor-pointer group"
            >
              <div className="w-48 bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-300">
                {pack.image_url ? (
                  <div className="aspect-square relative overflow-hidden">
                    <Image
                      src={pack.image_url}
                      alt={pack.name}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <span className="text-4xl font-arabic text-gray-300">ع</span>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-medium text-heading text-sm">{pack.name}</h3>
                  <p className="text-xs text-subtle">
                    {packWordCounts[pack.id] || 0} words
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
          {/* View all packs card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + 20 * 0.03, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => handleCtaClick("view_all_packs")}
            className="flex-shrink-0 snap-start cursor-pointer group"
          >
            <div className="w-48 bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-300">
              <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center">
                <span className="text-3xl mb-2 text-gray-400 group-hover:text-gray-600 transition-colors">→</span>
              </div>
              <div className="p-3">
                <h3 className="font-medium text-heading text-sm">View all packs</h3>
                <p className="text-xs text-subtle">{packs.length} packs available</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Scroll indicator */}
      {showChevron && !hasScrolled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center pb-8 cursor-pointer -space-y-3"
          onClick={() => howItWorksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <CaretDown size={24} weight="bold" className="text-disabled" />
          <CaretDown size={24} weight="bold" className="text-disabled" />
        </motion.div>
      )}

      {/* Pack Preview Modal */}
      <AnimatePresence>
        {selectedPack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedPack(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              {/* Pack header with image */}
              <div className="relative">
                {selectedPack.image_url ? (
                  <div className="h-48 relative">
                    <Image
                      src={selectedPack.image_url}
                      alt={selectedPack.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    <span className="text-6xl font-arabic text-gray-300">ع</span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedPack(null)}
                  className="absolute top-3 right-3 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                >
                  <X className="w-5 h-5 text-body" />
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-2xl font-bold text-white">{selectedPack.name}</h3>
                  <p className="text-white/80 text-sm">{packWordCounts[selectedPack.id] || 0} words</p>
                </div>
              </div>

              {/* Preview words */}
              <div className="p-4 pt-4 pb-0">
                <p className="text-sm text-subtle mb-3">Preview words:</p>
                {/* Fixed height container to prevent layout shift */}
                <div className="relative h-[284px] overflow-hidden">
                  {loadingPreview || previewWords.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2 pb-16">
                      {previewWords.map((word) => (
                        <div
                          key={word.id}
                          className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                        >
                          <span className="text-heading font-medium">{word.english}</span>
                          <span className="text-body font-arabic text-lg">{word.arabic}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Fade gradient at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                </div>
              </div>
              <div className="p-4 pt-0">
                <Button
                  onClick={() => {
                    setSelectedPack(null);
                    handleCtaClick("pack_preview_start");
                  }}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full py-6"
                >
                  Start learning this pack
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works - interactive */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6 }}
        className="py-24 px-4 bg-gray-50/80"
      >
        <div
          className="max-w-5xl mx-auto"
          ref={howItWorksRef}
          onMouseEnter={() => setIsHowItWorksPaused(true)}
          onMouseLeave={() => setIsHowItWorksPaused(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <h2 className="font-pphatton text-3xl sm:text-4xl font-bold text-heading">
              How it works
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Steps - vertical timeline */}
            <div className="relative">
              {/* Connecting line - positioned at center of circles (p-3 + w-10/2 = 12px + 20px = 32px) */}
              <div
                className="absolute left-8 top-8 bottom-0 w-px"
                style={{ background: 'linear-gradient(to bottom, #e5e7eb 0%, #e5e7eb 70%, transparent 100%)' }}
              />

              {/* Progress line - shows completed steps + current timer progress */}
              <div
                className="absolute left-8 top-8 w-px origin-top"
                style={{
                  height: 'calc(100% - 32px)',
                  background: 'linear-gradient(to bottom, #111827 0%, #111827 70%, transparent 100%)',
                  transform: `scaleY(${
                    activeStep === 1 ? timerProgress * 0.5 :
                    activeStep === 2 ? 0.5 + timerProgress * 0.5 :
                    1
                  })`,
                  transformOrigin: 'top',
                  transition: isHowItWorksPaused ? 'transform 0.3s ease' : 'none'
                }}
              />

              <div className="space-y-2">
                {[
                  { step: 1, title: "Pick a pack or add your own", desc: "Start with curated high-frequency words, or add vocabulary from your teacher, shows, or conversations." },
                  { step: 2, title: "Review daily", desc: "Spaced repetition shows you words right before you'd forget them. A few minutes a day is all it takes." },
                  { step: 3, title: "Recall actively", desc: "You see English, try to remember Arabic. This active effort builds stronger memory than passive reading." },
                ].map((item, index) => (
                  <motion.button
                    key={item.step}
                    onClick={() => setActiveStep(item.step)}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ delay: index * 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-5 w-full text-left p-3 rounded-xl transition-colors duration-300 hover:bg-gray-50 group"
                  >
                    {/* Step number */}
                    <div className="relative z-10">
                      <motion.div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-colors duration-300"
                        animate={{
                          backgroundColor: activeStep === item.step ? '#111827' : '#ffffff',
                          borderColor: activeStep === item.step ? '#111827' : activeStep > item.step ? '#111827' : '#e5e7eb',
                          color: activeStep === item.step ? '#ffffff' : activeStep > item.step ? '#111827' : '#9ca3af',
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        {activeStep > item.step ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          item.step
                        )}
                      </motion.div>
                    </div>

                    {/* Content - fixed height container */}
                    <div className="flex-1 pt-1.5 min-h-[88px]">
                      <motion.h3
                        className="font-semibold text-base mb-1.5 transition-colors duration-300"
                        animate={{ color: activeStep === item.step ? '#111827' : '#6b7280' }}
                      >
                        {item.title}
                      </motion.h3>
                      <motion.p
                        className="text-sm leading-relaxed transition-colors duration-300"
                        animate={{ color: activeStep === item.step ? '#6b7280' : '#9ca3af' }}
                      >
                        {item.desc}
                      </motion.p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Demo area - changes based on activeStep */}
            <div className="relative h-[320px] flex items-center justify-center">
              {/* Step 1: Pack fanning into words */}
              <motion.div
                initial={false}
                animate={{
                  opacity: activeStep === 1 ? 1 : 0,
                  scale: activeStep === 1 ? 1 : 0.9,
                  y: activeStep === 1 ? 0 : activeStep > 1 ? -30 : 30,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ pointerEvents: activeStep === 1 ? 'auto' : 'none' }}
              >
                <div className="relative">
                  {/* Pack card */}
                  <motion.div
                    className="w-40 h-40 rounded-2xl overflow-hidden border border-gray-200 shadow-lg mx-auto"
                    animate={{
                      scale: activeStep === 1 ? 1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <Image
                      src="https://fyivbeipfwtogeszgfnd.supabase.co/storage/v1/object/public/pack-images/government-society.png"
                      alt="Government & Society"
                      width={160}
                      height={160}
                      className="object-cover w-full h-full"
                    />
                  </motion.div>

                  {/* Fanned word cards - overlapping pack */}
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex justify-center gap-3">
                    {demoCards.map((card, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          opacity: activeStep === 1 ? 1 : 0,
                          y: activeStep === 1 ? 0 : -20,
                          rotate: activeStep === 1 ? (i - 1) * 8 : 0,
                          scale: activeStep === 1 ? 1 : 0.8,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 25,
                          delay: activeStep === 1 ? 0.15 + i * 0.05 : 0,
                        }}
                        className="w-16 h-20 bg-white rounded-lg border border-gray-200 shadow-md flex flex-col items-center justify-center p-1.5"
                      >
                        <span className="text-lg font-arabic">{card.arabic}</span>
                        <span className="text-[10px] text-disabled">{card.english}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Shared flashcard for steps 2 & 3 */}
              <motion.div
                initial={false}
                animate={{
                  opacity: activeStep >= 2 ? 1 : 0,
                  scale: activeStep >= 2 ? 1 : 0.9,
                  y: activeStep >= 2 ? 0 : 30,
                }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ pointerEvents: activeStep >= 2 ? 'auto' : 'none' }}
              >
                <div className="w-full max-w-xs">
                  {/* Progress bar - matches actual product */}
                  <motion.div
                    className="w-full mb-4 flex items-center gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: activeStep >= 2 ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: activeStep === 2 ? '16.6%' : activeStep === 3 ? (showFeedback ? '33%' : '16.6%') : '0%' }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-subtle tabular-nums">
                      {activeStep === 2 ? '1' : showFeedback ? '2' : '1'}/6
                    </span>
                  </motion.div>

                  {/* Card with decorative stack */}
                  <div className="relative">
                    {/* Back cards (decorative stack) */}
                    <motion.div
                      className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-gray-200"
                      animate={{
                        x: -6,
                        y: -8,
                        rotate: -2,
                        opacity: activeStep >= 2 ? 0.5 : 0
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.05 }}
                    />
                    <motion.div
                      className="absolute inset-0 bg-white rounded-2xl shadow-sm border border-gray-200"
                      animate={{
                        x: -3,
                        y: -4,
                        rotate: -1,
                        opacity: activeStep >= 2 ? 0.75 : 0
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.025 }}
                    />

                    {/* Main card */}
                    <div className="relative bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    {/* Feedback overlay */}
                    <AnimatePresence>
                      {showFeedback && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 z-20 flex items-center justify-center"
                          initial={{ x: "-100%" }}
                          animate={{ x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        >
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 25 }}
                            className="flex flex-col items-center text-white"
                          >
                            <Star size={40} weight="fill" />
                            <span className="text-xl font-bold mt-1">Perfect!</span>
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.05 }}
                              className="text-sm text-white/90 mt-1"
                            >
                              Next review in 4 days
                            </motion.span>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Card content area */}
                    <div className="h-[170px] flex flex-col items-center justify-center p-6 relative">
                      {/* English (front) */}
                      <motion.p
                        className="text-3xl font-semibold text-heading absolute"
                        animate={{
                          opacity: activeStep === 2 ? 1 : 0,
                          y: activeStep === 2 ? 0 : -10,
                          scale: activeStep === 2 ? 1 : 0.95,
                        }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {demoCards[0].english}
                      </motion.p>

                      {/* Arabic (back) */}
                      <motion.div
                        className="flex flex-col items-center absolute"
                        animate={{
                          opacity: activeStep === 3 ? 1 : 0,
                          y: activeStep === 3 ? 0 : 10,
                          scale: activeStep === 3 ? 1 : 0.95,
                        }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <p className="text-3xl font-arabic mb-1">
                          {demoCards[0].arabic}
                        </p>
                        <p className="text-sm text-body">
                          {demoCards[0].transliteration}
                        </p>
                      </motion.div>
                    </div>

                    {/* Footer area - fixed height */}
                    <div className="border-t border-gray-100 bg-gray-50/50 h-14 flex items-center justify-center px-3">
                      {/* Tap to reveal hint */}
                      {activeStep === 2 && (
                        <motion.p
                          className="text-xs text-disabled"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          tap to reveal
                        </motion.p>
                      )}

                      {/* Rating buttons */}
                      {activeStep === 3 && (
                        <motion.div
                          className="grid grid-cols-4 gap-1.5 w-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {[
                            { label: "Forgot", bg: "bg-red-50", border: "border-red-200", color: "text-red-700" },
                            { label: "Struggled", bg: "bg-orange-50", border: "border-orange-200", color: "text-orange-700" },
                            { label: "Remembered", bg: "bg-green-50", border: "border-green-200", color: "text-green-700" },
                            { label: "Perfect", bg: "bg-gradient-to-r from-emerald-500 to-teal-500", border: "border-transparent", color: "text-white shadow-md" },
                          ].map((btn) => (
                            <div
                              key={btn.label}
                              className={`py-1.5 rounded-lg border text-[10px] font-medium text-center ${btn.bg} ${btn.border} ${btn.color}`}
                            >
                              {btn.label}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Levels preview */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center flex flex-col items-center mb-12"
          >
            <h2 className="font-pphatton text-3xl sm:text-4xl font-bold text-heading mb-3">
              Your journey
            </h2>
            <p className="text-body max-w-lg">
              Learning commonly used words first helps you understand the majority of conversations within a few hundred words.
            </p>
          </motion.div>

          {/* Progress bar with illustrations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="p-6"
          >
            {/* Illustrations row */}
            <div className="flex mb-3">
              {[
                { logo: "/logo-tourist-aligned.svg", label: "Tourist", words: "50", delay: 0.3 },
                { logo: "/logo-visitor-aligned.svg", label: "Visitor", words: "150", delay: 1.0 },
                { logo: "/logo-resident-aligned.svg", label: "Resident", words: "350", delay: 1.9 },
                { logo: "/logo-local-aligned.svg", label: "Local", words: "600", delay: 3.0 },
              ].map((level, i) => (
                <div
                  key={level.label}
                  className="flex flex-col items-center w-12"
                  style={{ flex: i === 0 ? 50 : i === 1 ? 100 : i === 2 ? 200 : 250 }}
                >
                  <motion.div
                    className="size-24 mb-2"
                    initial={{ opacity: 0.25 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: level.delay, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Image
                      src={level.logo}
                      alt={level.label}
                      width={56}
                      height={56}
                      className="w-full h-full"
                    />
                  </motion.div>
                  <motion.span
                    className="text-xs font-medium text-heading"
                    initial={{ opacity: 0.4 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: level.delay, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {level.label}
                  </motion.span>
                  <span className="text-[10px] text-disabled">{level.words}</span>
                </div>
              ))}
            </div>

            {/* Progress bar - animated from 0 to 600 words */}
            <div className="flex gap-1 h-3 mb-4">
              {/* Tourist: 0-50 */}
              <div className="flex-[50] rounded-l-full overflow-hidden bg-gray-100">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: '0%' }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              {/* Visitor: 50-150 */}
              <div className="flex-[100] overflow-hidden bg-gray-100">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: '0%' }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              {/* Resident: 150-350 */}
              <div className="flex-[200] overflow-hidden bg-gray-100">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: '0%' }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 1.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              {/* Local: 350-600, mostly filled */}
              <div className="flex-[250] rounded-r-full overflow-hidden bg-gray-100 flex">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={{ width: '0%' }}
                  whileInView={{ width: '72%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, delay: 3.0, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.div
                  className="h-full bg-emerald-300"
                  initial={{ width: '0%' }}
                  whileInView={{ width: '20%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 4.2, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-body">Learned <span className="font-semibold text-heading">530</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                <span className="text-body">Learning <span className="font-semibold text-heading">50</span></span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-sm p-12 text-center">
            <DottedGlowBackground
              gap={20}
              radius={1.5}
              color="rgba(0,0,0,0.12)"
              glowColor="#47907D"
              opacity={0.7}
              speedScale={0.4}
            />
            <div className="relative z-10">
              <h2 className="font-pphatton text-3xl sm:text-4xl font-bold text-heading mb-4">
                Ready to start?
              </h2>
              <p className="text-body mb-8 max-w-md mx-auto">
                Join learners building real Lebanese Arabic fluency, one word at a time.
              </p>
              <Button
                size="lg"
                onClick={() => handleCtaClick("footer_cta")}
                className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-10 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Get started free
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      <PublicFooter maxWidth="max-w-3xl" />
    </div>
  );
}
