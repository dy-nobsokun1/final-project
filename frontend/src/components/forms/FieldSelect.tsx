"use client";

import { useField } from "@/components/forms/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FieldSelectProps {
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  onValueChange?: (value: string) => void;
}

/**
 * shadcn `Select` bound to its `<Field>`, like `FieldInput`: the field's label points at the
 * trigger, and `name` puts the chosen value into the form's FormData.
 */
export function FieldSelect({ name, defaultValue, options, onValueChange }: FieldSelectProps) {
  const { controlId, errorId, hasError } = useField();

  return (
    <Select name={name} defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectTrigger
        id={controlId}
        className="w-full"
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
