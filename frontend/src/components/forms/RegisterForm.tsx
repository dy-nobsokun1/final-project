"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { register } from "@/lib/api/actions";

/**
 * Registration form. Creates the account through the API, which emails a 6-digit code,
 * then shows the "check your email" step. Nobody is signed in until that code is entered.
 */
export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    major: "",
    graduationYear: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: keyof typeof values) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};

    if (!values.name.trim()) next.name = "Enter your name.";
    if (!values.email.trim().toLowerCase().endsWith(".edu.kh")) {
      next.email = "Use your campus email (ending in .edu.kh).";
    }
    if (values.password.length < 8) next.password = "Use at least 8 characters.";
    const year = Number(values.graduationYear);
    if (!Number.isInteger(year) || year < 2024 || year > 2035) {
      next.graduationYear = "Enter a year between 2024 and 2035.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    const result = await register({ ...values, name: values.name.trim(), graduationYear: year });
    setIsSubmitting(false);
    if (result.error) {
      // Field errors from the API (e.g. email) go under their field; anything else under the button.
      setErrors({ ...result.fieldErrors, form: result.error });
      return;
    }
    router.push("/verify-email");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Full name" error={errors.name}>
        <FieldInput
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(event) => update("name")(event.target.value)}
        />
      </Field>
      <Field label="Campus email" error={errors.email}>
        <FieldInput
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@university.edu.kh"
          value={values.email}
          onChange={(event) => update("email")(event.target.value)}
        />
      </Field>
      <Field label="Password" error={errors.password}>
        <FieldInput
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          onChange={(event) => update("password")(event.target.value)}
        />
      </Field>
      <Field label="Major">
        <FieldInput
          name="major"
          placeholder="Computer Science"
          value={values.major}
          onChange={(event) => update("major")(event.target.value)}
        />
      </Field>
      <Field label="Graduation year" error={errors.graduationYear}>
        <FieldInput
          name="graduationYear"
          type="number"
          inputMode="numeric"
          value={values.graduationYear}
          onChange={(event) => update("graduationYear")(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Account type</span>
        <Select name="accountType" defaultValue="student">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
      {errors.form ? (
        <p role="alert" className="text-sm text-foreground">
          {errors.form}
        </p>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-foreground underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

