import type { ReviewTier, Widget, WordProposal } from "@/app/v2/lib/types";
import { WordCard } from "./WordCard";
import { QuizMC } from "./QuizMC";
import { RecallInput } from "./RecallInput";
import { ProduceCold } from "./ProduceCold";
import { AddWordsPreview } from "./AddWordsPreview";
import { WordPicker } from "./WordPicker";
import { OnboardingChoice } from "./OnboardingChoice";
import { PackList } from "./PackList";
import { ReviewVerdict } from "./ReviewVerdict";
import { DataChange } from "./DataChange";
import { InstructionsEditor } from "./InstructionsEditor";
import { SessionSummary } from "./SessionSummary";

// Mutating actions resolve to a success boolean so widgets can commit their
// confirmed/answered visuals ON SUCCESS instead of optimistically -- a failed
// write must leave the widget interactive, never a false receipt.
export interface WidgetActions {
  onAnswer: (wordId: string, tier: ReviewTier, submitted: string) => Promise<boolean>;
  onConfirmWords: (proposals: WordProposal[]) => Promise<boolean>;
  onChooseOnboarding: (choice: "add_words" | "browse_packs") => void;
  onStartPack: (packId: string) => Promise<boolean>;
  onStartWords: (wordIds: string[]) => Promise<boolean>;
  // Decline a confirm-style widget (pack list, word picker, preview) so it
  // stops gating the action chips.
  onDismiss: () => void;
}

export function WidgetRenderer({
  widget,
  actions,
  active = false,
  answered = false,
}: {
  widget: Widget;
  actions: WidgetActions;
  active?: boolean;
  // Durable answered state from the conversation (survives remounts and
  // reloads) -- components must not rely on local state alone for this.
  answered?: boolean;
}) {
  switch (widget.type) {
    case "onboarding_choice":
      return <OnboardingChoice onChoose={actions.onChooseOnboarding} />;
    case "pack_list":
      return (
        <PackList
          widget={widget}
          onStartPack={actions.onStartPack}
          onDismiss={actions.onDismiss}
          answered={answered}
        />
      );
    case "word_card":
      return <WordCard word={widget.word} imageUrl={widget.image_url} active={active} />;
    case "quiz_mc":
      return <QuizMC widget={widget} onAnswer={actions.onAnswer} active={active} answered={answered} />;
    case "recall_input":
      return <RecallInput widget={widget} onAnswer={actions.onAnswer} active={active} answered={answered} />;
    case "produce_cold":
      return <ProduceCold widget={widget} onAnswer={actions.onAnswer} active={active} answered={answered} />;
    case "add_words_preview":
      return (
        <AddWordsPreview
          widget={widget}
          onConfirm={actions.onConfirmWords}
          onDismiss={actions.onDismiss}
          answered={answered}
        />
      );
    case "word_picker":
      return (
        <WordPicker
          widget={widget}
          onStartWords={actions.onStartWords}
          onDismiss={actions.onDismiss}
          answered={answered}
        />
      );
    case "review_verdict":
      return <ReviewVerdict widget={widget} />;
    case "data_change":
      return <DataChange widget={widget} />;
    case "instructions_editor":
      return <InstructionsEditor initial={widget.instructions} />;
    case "session_summary":
      return <SessionSummary widget={widget} />;
    default:
      return null;
  }
}
