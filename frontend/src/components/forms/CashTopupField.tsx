import { Field, FieldInput } from "@/components/forms/Field";

interface CashTopupFieldProps {
  error?: string;
  /** When editing a trade: its current top-up. */
  defaultValue?: number | null;
}

/** The sell form's extra box for a trade: cash the owner asks for on top of an uneven swap. Empty means none. */
export function CashTopupField({ error, defaultValue }: CashTopupFieldProps) {
  return (
    <Field label="Cash top-up you ask for (USD, optional)" error={error}>
      <FieldInput
        name="cashTopup"
        type="number"
        min={0}
        step="1"
        inputMode="decimal"
        defaultValue={defaultValue ?? undefined}
        className="bg-brand-50/40 placeholder:text-foreground/50 dark:placeholder:text-muted-foreground"
      />
    </Field>
  );
}
