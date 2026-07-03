// Stacked-deck framing for the active review card: two offset card layers
// peek out below, so the current word reads as the top of a physical pile.
export function DeckFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <div
        className="absolute inset-x-6 top-3 h-full rounded-2xl bg-white border border-gray-200 opacity-50"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-3 top-1.5 h-full rounded-2xl bg-white border border-gray-200 opacity-75"
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
