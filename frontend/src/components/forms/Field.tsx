"use client";

import { createContext, useContext, useId } from "react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Form field wrapper.
 *
 * shadcn's `Input` and `Textarea` are unstyled single elements, so every form
 * would otherwise repeat the same label, error, and id wiring. This provides it
 * once and links the label and error to the control for screen readers.
 */

interface FieldContextValue {
  controlId: string;
  errorId: string;
  hasError: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue {
  const context = useContext(FieldContext);
  if (!context) throw new Error("Field parts must be used inside <Field>");
  return context;
}

interface FieldProps {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Provides ids and error state to `FieldLabel`, `FieldError`, and the control. */
export function Field({ label, error, className, children }: FieldProps) {
  const controlId = useId();
  const errorId = `${controlId}-error`;
  const value = { controlId, errorId, hasError: Boolean(error) };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <FieldLabel>{label}</FieldLabel>
        {children}
        <FieldError message={error} />
      </div>
    </FieldContext.Provider>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  const { controlId, hasError } = useField();
  // Text stays black everywhere; the error state is signalled by a red
  // underline instead, since red text failed contrast on the green field.
  return (
    <Label
      htmlFor={controlId}
      className={hasError ? "underline decoration-brand-danger decoration-2 underline-offset-4" : undefined}
    >
      {children}
    </Label>
  );
}

export function FieldError({ message }: { message?: string }) {
  const { errorId, hasError } = useField();
  if (!hasError) return null;
  return (
    <p id={errorId} role="alert" className="text-sm text-foreground">
      {message}
    </p>
  );
}

type InputProps = React.ComponentProps<typeof Input>;

/** shadcn `Input` bound to the field's id and error state. */
export function FieldInput(props: InputProps) {
  const { controlId, errorId, hasError } = useField();
  return (
    <Input
      id={controlId}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      {...props}
    />
  );
}

type TextareaProps = React.ComponentProps<typeof Textarea>;

/** shadcn `Textarea` bound to the field's id and error state. */
export function FieldTextarea(props: TextareaProps) {
  const { controlId, errorId, hasError } = useField();
  return (
    <Textarea
      id={controlId}
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      {...props}
    />
  );
}


