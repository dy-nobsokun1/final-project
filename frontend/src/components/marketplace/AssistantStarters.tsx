import { Sparkles } from "lucide-react";

/** Example questions, so a first-time student sees what to ask. */
const STARTERS = [
  "A cheap calculator for my exam",
  "Free things for my dorm room",
  "A bike under $50",
  "Calculus textbooks",
];

/** What an empty Ask UniSwap chat shows. Tapping an example asks it straight away. */
export function AssistantStarters({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <Sparkles aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="font-medium text-foreground">What are you looking for?</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Describe it in your own words, with a budget if you have one. Ask UniSwap searches the
        listings for you, and can draft a wanted post when nothing fits.
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="rounded-full border border-brand-ink/30 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-brand-50"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
