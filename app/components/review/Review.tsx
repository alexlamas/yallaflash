import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SpacedRepetitionService } from "../../services/spacedRepetitionService";
import { useAuth } from "../../contexts/AuthContext";
import { Word, Sentence } from "../../types/word";
import { SentenceService } from "../../services/sentenceService";
import BoostReview from "./BoostReview";
import { useWords } from "../../contexts/WordsContext";
import { useOfflineSync, offlineHelpers } from "../../hooks/useOfflineSync";
import { WordDetailModal } from "../WordDetailModal";
import { motion, AnimatePresence } from "framer-motion";
import { formatTimeUntilReview } from "../../utils/formatReviewTime";
import {
  Star,
  Sparkle,
  Ghost,
  SmileyNervous,
  Balloon,
  Lightbulb,
  NoteBlank,
} from "@phosphor-icons/react";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAIUsage } from "../../hooks/useAIUsage";
import posthog from "posthog-js";

export function Review() {
  const { session } = useAuth();
  const { toast } = useToast();
  const { refresh: refreshUsage } = useAIUsage();
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [currentWordSentences, setCurrentWordSentences] = useState<Sentence[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const hasLoadedRef = useRef(false);
  const [feedbackAnimation, setFeedbackAnimation] = useState<{
    isPlaying: boolean;
    text: string;
    color: string;
    nextReviewText?: string;
  }>({ isPlaying: false, text: "", color: "" });
  const { fetchReviewCount } = useWords();
  const { handleOfflineAction } = useOfflineSync();

  const loadNextWord = useCallback(async (showLoading = true) => {
    if (!session?.user) return;

    setError(null);
    setHint(null);
    setHintError(null);
    setShowNotes(false);
    setSentences([]);
    if (showLoading) setIsLoading(true);
    try {
      const words = await SpacedRepetitionService.getDueWords(
        session.user.id,
        1
      );
      setCurrentWord(words?.[0] || null);
      setIsFlipped(false);
    } catch {
      setError("Failed to load words. Please try again.");
      toast({
        variant: "destructive",
        title: "Failed to load word",
      });
    } finally {
      setIsLoading(false);
    }
  }, [session, toast]);

  const fetchHint = async () => {
    if (!currentWord || isLoadingHint) return;

    setIsLoadingHint(true);
    setHintError(null);
    setHint("");

    try {
      const response = await fetch("/api/generate-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          english: currentWord.english,
          arabic: currentWord.arabic,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.limitReached) {
          setHintError("No AI credits left this month");
        } else {
          setHintError("Failed to generate hint");
        }
        setHint(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setHintError("Failed to generate hint");
        setHint(null);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setHint(accumulated);
      }

      refreshUsage();
    } catch {
      setHintError("Failed to generate hint");
      setHint(null);
    } finally {
      setIsLoadingHint(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedRef.current && session?.user) {
      hasLoadedRef.current = true;
      loadNextWord();
    }
  }, [loadNextWord, session?.user]);

  useEffect(() => {
    if (currentWord?.id) {
      SentenceService.getSentencesForWord(currentWord.id).then(setSentences);
    }
  }, [currentWord?.id]);

  const handleRating = async (rating: number) => {
    if (!session?.user || !currentWord) return;

    const feedbackText =
      rating === 0
        ? "Forgot"
        : rating === 1
        ? "Struggled"
        : rating === 2
        ? "Remembered"
        : "Perfect!";
    const feedbackColor =
      rating === 0
        ? "bg-red-500"
        : rating === 1
        ? "bg-orange-500"
        : rating === 2
        ? "bg-green-500"
        : "bg-gradient-to-r from-emerald-500 to-teal-500";

    setFeedbackAnimation({
      isPlaying: true,
      text: feedbackText,
      color: feedbackColor,
    });

    const result = await handleOfflineAction(
      () =>
        SpacedRepetitionService.processReview(
          session.user.id,
          currentWord.id,
          rating
        ),
      () =>
        offlineHelpers.updateProgress(
          session.user.id,
          currentWord.id,
          rating
        )
    );

    posthog.capture("word_reviewed", { rating });

    let nextReviewText = "";
    if (result && result.nextReview) {
      const formattedTime = formatTimeUntilReview(
        result.nextReview.toISOString()
      );
      if (formattedTime) {
        if (formattedTime === "Today") {
          nextReviewText = "Later today";
        } else if (formattedTime === "Tomorrow") {
          nextReviewText = "Tomorrow";
        } else if (formattedTime === "Next week") {
          nextReviewText = "In a week";
        } else if (formattedTime === "Next month") {
          nextReviewText = "In a month";
        } else if (formattedTime.includes("days")) {
          nextReviewText = `In ${formattedTime}`;
        } else if (formattedTime.includes("weeks")) {
          nextReviewText = `In ${formattedTime}`;
        } else if (formattedTime.includes("months")) {
          nextReviewText = `In ${formattedTime}`;
        } else {
          nextReviewText = formattedTime;
        }
      }
    }

    setFeedbackAnimation({
      isPlaying: true,
      text: feedbackText,
      color: feedbackColor,
      nextReviewText: nextReviewText,
    });

    fetchReviewCount();
    window.dispatchEvent(new CustomEvent("wordProgressUpdated"));

    setTimeout(() => {
      setFeedbackAnimation({ isPlaying: false, text: "", color: "" });
    }, 600);

    setTimeout(async () => {
      await loadNextWord(false);
    }, 800);
  };

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => loadNextWord()}>Try again</Button>
      </div>
    );
  }

  if (!isLoading && !currentWord) {
    if (!session?.user?.id) return null;
    return <BoostReview userId={session.user.id} loadNextWord={loadNextWord} />;
  }

  return (
    <div className="max-w-2xl w-full mx-auto">
      <Card
        className="w-full p-6 cursor-pointer shadow-md relative overflow-hidden"
        onClick={() => currentWord && setIsFlipped(!isFlipped)}
      >
        <CardContent className="min-h-[200px] flex items-center justify-center h-full relative z-10">
          <AnimatePresence mode="wait">
            {currentWord && (
              <motion.div
                key={`${currentWord.id}-${isFlipped ? "back" : "front"}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                {!isFlipped ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-semibold select-none">
                      {currentWord.english}
                    </h3>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-3xl font-arabic mb-2 select-none">
                      {currentWord.arabic}
                    </div>
                    <div className="text-sm text-body select-none">
                      {currentWord.transliteration}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {currentWord && !isFlipped && (
            <AnimatePresence mode="wait">
              {hint !== null && hint.length > 0 ? (
                <motion.div
                  key="hint"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-3 left-3 right-3 text-center pointer-events-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="inline-flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
                    <span className="text-sm text-amber-900 text-left leading-relaxed">
                      {hint}
                      {isLoadingHint && (
                        <motion.span
                          className="inline-block w-[2px] h-[14px] bg-amber-400 ml-0.5 align-middle"
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                        />
                      )}
                    </span>
                  </div>
                </motion.div>
              ) : hintError ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-3 left-1/2 text-sm text-red-500"
                  style={{ x: "-50%" }}
                >
                  {hintError}
                </motion.div>
              ) : showNotes && currentWord.notes ? (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, filter: "blur(4px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-3 left-3 right-3 text-center text-sm text-body pointer-events-none"
                >
                  {currentWord.notes}
                </motion.div>
              ) : (
                <motion.div
                  key="buttons"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-3 left-1/2 flex gap-2"
                  style={{ x: "-50%" }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchHint();
                    }}
                    disabled={isLoadingHint}
                    className="rounded-full shadow-none"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Get a hint
                  </Button>
                  {currentWord.notes && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNotes(true);
                      }}
                      className="rounded-full"
                    >
                      <NoteBlank className="h-4 w-4" />
                      Notes
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </CardContent>

          {isFlipped && (
            <div className="absolute bottom-3 right-3 z-10">
              <Button
                variant="ghost"
                size="sm"
                className="flex group text-subtle hover:text-heading"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (currentWord) {
                    const sentences = await SentenceService.getSentencesForWord(currentWord.id);
                    setCurrentWordSentences(sentences);
                  }
                  setIsModalOpen(true);
                }}
              >
                Open
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-all group-hover:-rotate-12" />
              </Button>
            </div>
          )}

          <AnimatePresence>
            {feedbackAnimation.isPlaying && (
              <motion.div
                key="feedback-overlay"
                className={`absolute inset-0 ${feedbackAnimation.color} z-20 flex items-center justify-center`}
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: [0.23, 1, 0.32, 1],
                }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-black/10" />

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.15,
                    duration: 0.15,
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                  }}
                  className="relative z-30 flex flex-col items-center"
                >
                  <div className="text-white flex flex-col items-center gap-2">
                    {feedbackAnimation.text === "Forgot" && (
                      <Ghost size={48} weight="fill" />
                    )}
                    {feedbackAnimation.text === "Struggled" && (
                      <SmileyNervous size={48} weight="fill" />
                    )}
                    {feedbackAnimation.text === "Remembered" && (
                      <Balloon size={48} weight="fill" />
                    )}
                    {feedbackAnimation.text === "Perfect!" && (
                      <Star size={48} weight="fill" />
                    )}
                    <span className="text-2xl font-bold">{feedbackAnimation.text}</span>
                  </div>
                  <div className="mt-2 h-5">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: feedbackAnimation.nextReviewText ? 1 : 0 }}
                      transition={{
                        delay: 0.05,
                        duration: 0.1,
                      }}
                      className="text-white/90 text-sm font-medium"
                    >
                      {feedbackAnimation.nextReviewText || ' '}
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

      {currentWord && isFlipped && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 *:gap-2 *:font-semibold"
        >
          <Button
            variant="outline"
            onClick={() => handleRating(0)}
            className="bg-red-50 hover:bg-red-100 border-red-200 !text-red-700 flex items-center w-full"
          >
            <Ghost className="h-4 w-4" weight="bold" />
            Forgot
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRating(1)}
            className="bg-orange-50 hover:bg-orange-100 border-orange-200 !text-orange-700 flex items-center w-full"
          >
            <SmileyNervous weight="bold" className="h-4 w-4" />
            Struggled
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRating(2)}
            className="bg-green-50 hover:bg-green-100 border-green-200 !text-green-700 flex items-center w-full"
          >
            <Balloon weight="bold" className="h-4 w-4" />
            Remembered
          </Button>
          <Button
            onClick={() => handleRating(3)}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:scale-105 active:scale-100 flex items-center relative overflow-hidden group shadow-lg hover:shadow-xl border-0 transition-all w-full"
          >
            <div className="relative">
              <Star
                weight="fill"
                className="h-4 w-4 transition-transform group-hover:scale-0 group-hover:opacity-0 group-hover:rotate-12"
              />
              <Sparkle
                weight="fill"
                className="h-4 w-4 absolute inset-0 scale-0 opacity-0 transition-transform group-hover:scale-110 group-hover:opacity-100 group-hover:rotate-12"
              />
            </div>
            Perfect
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </div>
          </Button>
        </motion.div>
      )}

      {currentWord && isFlipped && sentences.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100"
        >
          <p className="font-arabic text-lg mb-1">{sentences[0].arabic}</p>
          {sentences[0].transliteration && (
            <p className="text-sm text-subtle mb-1">{sentences[0].transliteration}</p>
          )}
          <p className="text-sm text-body">{sentences[0].english}</p>
        </motion.div>
      )}

      <WordDetailModal
        word={currentWord}
        sentences={currentWordSentences}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWordUpdate={(updatedWord) => {
          setCurrentWord(updatedWord);
        }}
      />
    </div>
  );
}
