// Visual variety for review cards: each card is dealt a flavor when it's
// built server-side, and the flavor rides in the widget so a card keeps its
// look across reloads. Purely presentational -- grading, tiers, and the SRS
// never read it. "classic" reproduces the original card styling exactly, so
// widgets persisted before flavors existed render unchanged.

export type CardFlavor = "classic" | "mint" | "sand" | "sky" | "rose" | "night";

export const CARD_FLAVORS: CardFlavor[] = ["classic", "mint", "sand", "sky", "rose", "night"];

export function randomFlavor(): CardFlavor {
  return CARD_FLAVORS[Math.floor(Math.random() * CARD_FLAVORS.length)];
}

export interface FlavorStyles {
  /** Card surface (background, border, base text) */
  card: string;
  /** The big cue word */
  cue: string;
  /** Prompts, memory hooks, translations */
  muted: string;
  /** The context-sentence line */
  context: string;
  /** The tested word inside a context sentence */
  highlight: string;
  /** Multiple-choice option buttons */
  option: string;
  /** The clicked option (neutral -- the verdict says right/wrong) */
  optionSelected: string;
  /** Number-key hint chip on options */
  kbd: string;
  /** Text inputs */
  input: string;
  /** Submit button */
  button: string;
}

export const FLAVOR_STYLES: Record<CardFlavor, FlavorStyles> = {
  classic: {
    card: "",
    cue: "",
    muted: "text-subtle",
    context: "text-gray-700",
    highlight: "font-semibold text-green-700",
    option: "hover:border-green-400 hover:bg-green-50/50",
    optionSelected: "border-gray-400 bg-gray-50",
    kbd: "border-gray-200 bg-gray-50 text-disabled",
    input: "",
    button: "bg-green-600 hover:bg-green-700",
  },
  mint: {
    card: "bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 border-emerald-200",
    cue: "",
    muted: "text-subtle",
    context: "text-gray-700",
    highlight: "font-semibold text-emerald-700",
    option: "hover:border-emerald-400 hover:bg-emerald-50/60",
    optionSelected: "border-gray-400 bg-gray-50",
    kbd: "border-emerald-100 bg-white text-disabled",
    input: "",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
  sand: {
    card: "bg-gradient-to-br from-amber-50 via-white to-orange-50/70 border-amber-200",
    cue: "",
    muted: "text-subtle",
    context: "text-gray-700",
    highlight: "font-semibold text-amber-700",
    option: "hover:border-amber-400 hover:bg-amber-50/60",
    optionSelected: "border-gray-400 bg-gray-50",
    kbd: "border-amber-100 bg-white text-disabled",
    input: "",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  sky: {
    card: "bg-gradient-to-br from-sky-50 via-white to-indigo-50/70 border-sky-200",
    cue: "",
    muted: "text-subtle",
    context: "text-gray-700",
    highlight: "font-semibold text-sky-700",
    option: "hover:border-sky-400 hover:bg-sky-50/60",
    optionSelected: "border-gray-400 bg-gray-50",
    kbd: "border-sky-100 bg-white text-disabled",
    input: "",
    button: "bg-sky-600 hover:bg-sky-700",
  },
  rose: {
    card: "bg-gradient-to-br from-rose-50 via-white to-pink-50/70 border-rose-200",
    cue: "",
    muted: "text-subtle",
    context: "text-gray-700",
    highlight: "font-semibold text-rose-700",
    option: "hover:border-rose-400 hover:bg-rose-50/60",
    optionSelected: "border-gray-400 bg-gray-50",
    kbd: "border-rose-100 bg-white text-disabled",
    input: "",
    button: "bg-rose-600 hover:bg-rose-700",
  },
  night: {
    card: "bg-gray-900 border-gray-800 text-gray-100 shadow-xl",
    cue: "text-white",
    muted: "text-gray-400",
    context: "text-gray-300",
    highlight: "font-semibold text-emerald-300",
    option: "border-gray-700 bg-gray-800/80 text-gray-100 hover:bg-gray-700 hover:border-gray-500 hover:text-white",
    optionSelected: "border-gray-400 bg-gray-700 text-white",
    kbd: "border-gray-600 bg-gray-800 text-gray-500",
    input: "border-gray-700 bg-gray-800/60 text-gray-100 placeholder:text-gray-500",
    button: "bg-emerald-500 hover:bg-emerald-400 text-gray-950",
  },
};

export function flavorStyles(flavor: string | undefined): FlavorStyles {
  return FLAVOR_STYLES[(flavor ?? "classic") as CardFlavor] ?? FLAVOR_STYLES.classic;
}
