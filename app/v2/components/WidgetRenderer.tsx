import type { ReviewTier, Widget, WordProposal } from "@/app/v2/lib/types";
import { WordCard } from "./WordCard";
import { QuizMC } from "./QuizMC";
import { RecallInput } from "./RecallInput";
import { ProduceCold } from "./ProduceCold";
import { AddWordsPreview } from "./AddWordsPreview";
import { OnboardingChoice } from "./OnboardingChoice";
import { PackList } from "./PackList";
import { ReviewVerdict } from "./ReviewVerdict";
import { SessionSummary } from "./SessionSummary";

export interface WidgetActions {
  onAnswer: (wordId: string, tier: ReviewTier, submitted: string) => void;
  onConfirmWords: (proposals: WordProposal[]) => void;
  onChooseOnboarding: (choice: "add_words" | "browse_packs") => void;
  onStartPack: (packId: string) => void;
}

export function WidgetRenderer({ widget, actions }: { widget: Widget; actions: WidgetActions }) {
  switch (widget.type) {
    case "onboarding_choice":
      return <OnboardingChoice onChoose={actions.onChooseOnboarding} />;
    case "pack_list":
      return <PackList widget={widget} onStartPack={actions.onStartPack} />;
    case "word_card":
      return <WordCard word={widget.word} imageUrl={widget.image_url} />;
    case "quiz_mc":
      return <QuizMC widget={widget} onAnswer={actions.onAnswer} />;
    case "recall_input":
      return <RecallInput widget={widget} onAnswer={actions.onAnswer} />;
    case "produce_cold":
      return <ProduceCold widget={widget} onAnswer={actions.onAnswer} />;
    case "add_words_preview":
      return <AddWordsPreview widget={widget} onConfirm={actions.onConfirmWords} />;
    case "review_verdict":
      return <ReviewVerdict widget={widget} />;
    case "session_summary":
      return <SessionSummary widget={widget} />;
    default:
      return null;
  }
}
