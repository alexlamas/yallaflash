import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CircleNotch, MagicWand, WarningCircle, Coin } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAIUsage } from "../hooks/useAIUsage";

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

export default function SentenceGenerator({ word }: SentenceGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sentence, setSentence] = useState<GeneratedSentence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { refresh: refreshUsage } = useAIUsage();

  React.useEffect(() => {
    const generateSentence = async () => {
      setIsGenerating(true);
      setError(null);
      setLimitReached(false);

      try {
        const response = await fetch("/api/generate-sentence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
            return;
          }
          throw new Error(errorData.error || "Failed to generate sentence");
        }

        const data = await response.json();
        setSentence(data);
        refreshUsage();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate sentence. Please try again.");
        toast({
          variant: "destructive",
          title: "Failed to generate sentence",
        });
      } finally {
        setIsGenerating(false);
      }
    };

    if (isOpen && !sentence && !isGenerating && !limitReached) {
      generateSentence();
    }
  }, [isOpen, sentence, isGenerating, limitReached, word, refreshUsage, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-black/5 h-auto px-2 py-1 border-[0.5px] border-violet-600/20 bg-gradient-to-t from-violet-500/10 to-violet-400/5 ml-1 group shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <MagicWand className="w-4 h-4 text-violet-600" />
              <span className="flex items-center gap-0.5 text-purple-600 ml-0.5">
                <Coin className="h-3.5 w-3.5" weight="fill" />
                <span className="text-xs">1</span>
              </span>
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Generate a sentence</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Example sentence with &quot;{word.arabic}&quot;
          </DialogTitle>
        </DialogHeader>

        <div className="relative min-h-28">
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              isGenerating ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="relative ">
              <div className="absolute inset-[-30px] rounded-full bg-gradient-to-r from-violet-600/50 via-fuchsia-500/50 to-violet-600/50 animate-[pulse_2s_ease-in-out_infinite] blur-2xl" />
              <div className="absolute inset-[-20px] rounded-full bg-gradient-to-r from-violet-400/40 via-fuchsia-400/40 to-violet-400/40 animate-[pulse_2s_ease-in-out_infinite_500ms] blur-xl" />
              <div className="relative bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent animate-[pulse_2s_ease-in-out_infinite_1000ms]">
                <CircleNotch className="h-16 w-16 animate-spin" />
              </div>
            </div>
          </div>

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              {limitReached ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 mx-4">
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
            </div>
          )}

          <div
            className={`transition-opacity duration-800 my-2 ${
              sentence && !isGenerating ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-3xl font-arabic">{sentence?.arabic}</div>
                <div className="text-sm text-muted-foreground">
                  {sentence?.transliteration}
                </div>
                <div className="text-sm font-medium">{sentence?.english}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
