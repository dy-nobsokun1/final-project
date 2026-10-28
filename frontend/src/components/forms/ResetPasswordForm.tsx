"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/api/actions";

/**
 * Sets a new password with the token from the emailed link. Nothing is used up until this form is
 * submitted. Afterwards the person signs in with the new password; the link itself creates no session.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters." });
      return;
    }
    setErrors({});
    setIsSaving(true);
    const result = await resetPassword(token, password);
    if (result.error) {
      // A short password goes under the field; an invalid or used link under the button.
      setErrors({ ...result.fieldErrors, form: result.error });
      setIsSaving(false);
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="New password" error={errors.password}>
        <FieldInput
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save new password"}
      </Button>
      {errors.form ? (
        <p role="alert" className="text-sm text-foreground">
          {errors.form}
        </p>
      ) : null}
      <p className="text-center text-sm text-muted-foreground">
        Link expired?{" "}
        <Link href="/forgot-password" className="font-semibold text-foreground underline">
          Ask for a new one
        </Link>
      </p>
    </form>
  );
}
