import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MagicWand, WarningCircle, Sparkle } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAIUsage } from "../hooks/useAIUsage";
import { motion, AnimatePresence } from "framer-motion";

interface SentenceGeneratorProps {
  word: {
    english: string;
    arabic: string;
    type?: string;
    notes?: string;
  };
}

interface GeneratedSentence {
  english: string;
  arabic: string;
  transliteration: string;
}

type StreamState = "idle" | "streaming" | "done" | "error";

export default function SentenceGenerator({ word }: SentenceGeneratorProps) {
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [sentence, setSentence] = useState<GeneratedSentence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { refresh: refreshUsage } = useAIUsage();

  const generateSentence = useCallback(async () => {
    setStreamState("streaming");
    setStreamedText("");
    setError(null);
    setLimitReached(false);
    setSentence(null);

    try {
      const response = await fetch("/api/generate-sentence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          word: word.arabic,
          english: word.english,
          type: word.type,
          notes: word.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.limitReached) {
          setLimitReached(true);
          setError(errorData.error || "Monthly AI limit reached");
          setStreamState("error");
          return;
        }
        throw new Error(errorData.error || "Failed to generate sentence");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              setStreamedText((prev) => prev + data.chunk);
            }
            if (data.done && data.result) {
              setSentence(data.result);
              setStreamState("done");
              refreshUsage();
            }
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (streamState !== "done") {
        setStreamState("done");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate sentence. Please try again."
      );
      setStreamState("error");
      toast({
        variant: "destructive",
        title: "Failed to generate sentence",
      });
    }
  }, [word, refreshUsage, toast, streamState]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      generateSentence();
    } else {
      setStreamState("idle");
      setStreamedText("");
      setSentence(null);
      setError(null);
      setLimitReached(false);
    }
  };

  const displaySentence = sentence;
  const isStreaming = streamState === "streaming";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-black/5 w-9 p-1 border-[0.5px] border-violet-600/20 bg-gradient-to-t from-violet-500/10 to-violet-400/5 ml-1 group shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MagicWand className="w-4 h-4 text-violet-600" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Generate a sentence</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[440px] gap-0 overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-base">
            Example sentence with &quot;{word.arabic}&quot;
          </DialogTitle>
        </DialogHeader>

        <div className="relative min-h-[120px]">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                {limitReached ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 w-full">
                    <div className="flex items-start gap-3">
                      <WarningCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" weight="fill" />
                      <div className="text-sm">
                        <p className="font-medium text-rose-800">Monthly limit reached</p>
                        <p className="text-rose-700 mt-1">
                          You&apos;ve used all your free AI generations this month. Your limit resets next month.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-red-500 text-sm">{error}</div>
                )}
              </motion.div>
            )}

            {!error && (isStreaming || displaySentence) && (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {displaySentence ? (
                  <div className="space-y-3">
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 p-4"
                    >
                      <p className="text-2xl font-arabic leading-relaxed text-violet-950">
                        {displaySentence.arabic}
                      </p>
                      <p className="text-sm text-violet-600 mt-1.5">
                        {displaySentence.transliteration}
                      </p>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="text-sm font-medium text-body px-1"
                    >
                      {displaySentence.english}
                    </motion.p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-100 p-4">
                    <div className="flex items-start gap-2">
                      <Sparkle className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5 animate-pulse" weight="fill" />
                      <p className="text-sm text-violet-700 leading-relaxed whitespace-pre-wrap">
                        {streamedText}
                        <motion.span
                          className="inline-block w-[2px] h-[14px] bg-violet-400 ml-0.5 align-middle"
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                        />
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {!error && !isStreaming && !displaySentence && streamState === "idle" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-[120px]"
              >
                <div className="relative">
                  <div className="absolute inset-[-20px] rounded-full bg-gradient-to-r from-violet-600/30 via-fuchsia-500/30 to-violet-600/30 animate-pulse blur-xl" />
                  <Sparkle className="h-10 w-10 text-violet-500 animate-pulse" weight="fill" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {displaySentence && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="pt-3 flex justify-end"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSentence}
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
            >
              <Sparkle className="h-3.5 w-3.5" weight="fill" />
              Generate another
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
