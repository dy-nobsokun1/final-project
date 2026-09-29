"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FieldInput, FieldTextarea } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";

/**
 * Create-a-listing form.
 *
 * Validation and navigation are wired up, but nothing is persisted: there is no
 * POST route yet. The submit handler is the single place to add the real call.
 */
export function NewListingForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const price = Number(data.get("price"));
    const description = String(data.get("description") ?? "").trim();

    const next: Record<string, string> = {};
    if (title.length < 5) next.title = "Use at least 5 characters.";
    if (!Number.isFinite(price) || price < 0) next.price = "Enter a valid price.";
    if (description.length < 20) next.description = "Describe the item in at least 20 characters.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    // No backend yet, so this only returns the user to their listings.
    router.push("/my-listings");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Title" error={errors.title}>
        <FieldInput name="title" placeholder="Calculus: Early Transcendentals, 9th ed." />
      </Field>
      <Field label="Description" error={errors.description}>
        <FieldTextarea
          name="description"
          rows={5}
          placeholder="Condition, defects, and what is included."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price (USD)" error={errors.price}>
          <FieldInput name="price" type="number" min={0} step="1" inputMode="decimal" />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Category</span>
          <Select name="category" defaultValue="textbooks">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Condition</span>
        <Select name="condition" defaultValue="good">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Publishing..." : "Publish listing"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

