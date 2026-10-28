import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

/** Labelled select, built from shadcn's Radix-based `Select`. */
export function FilterSelect({ label, value, onValueChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* The label sits on the light filter card, so it keeps a dark tone rather
          than the trigger's colours. brand-deep (#22312D) reads 8.34:1 on the
          #B1D3B9 card and matches the open panel, tying the two together.
          `text-center` aligns it over the trigger, which is w-44 from sm up. */}
      <span className="text-center text-sm font-bold uppercase tracking-wide text-brand-deep">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        {/* Closed state is the danger red with brand-50 (#E6F2DD) type -- 7.62:1.
            `[&>svg]` is required: the chevron is hardcoded to text-muted-foreground,
            which the enclosing `light-surface` scope resolves to #2E2E2E -- 1.54:1
            on this red, i.e. effectively invisible. A descendant selector outranks
            it. */}
        <SelectTrigger
          className="w-full border-destructive bg-destructive text-brand-50 hover:bg-destructive/90 sm:w-44 [&>svg]:text-brand-50"
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        {/* The option list is portalled out of the panel's `light-surface` scope,
            so it resolves tokens from :root rather than inheriting the trigger.
            Open state is brand-deep (#22312D), which is the same value as
            --background, so it needs the sage ring to keep an edge against the
            page field. #E6F2DD on #22312D is 11.72:1. The `focus:**:` descendant
            term is what actually paints the label and outranks a plain
            `focus:text-*` on the item itself. */}
        <SelectContent
          scrollButtonClassName="bg-brand-deep text-brand-50"
          className="bg-brand-deep text-brand-50 ring-brand-400/40"
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="focus:bg-destructive focus:text-brand-50 not-data-[variant=destructive]:focus:**:text-brand-50"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
