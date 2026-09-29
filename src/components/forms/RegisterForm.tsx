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

/**
 * Registration form. Creates no account yet: it validates the fields, then
 * sends the user to the email-verification step, which is where a real
 * confirmation email would be triggered.
 */
export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    email: "",
    major: "",
    graduationYear: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: keyof typeof values) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};

    if (!values.name.trim()) next.name = "Enter your name.";
    if (!values.email.includes("@")) next.email = "Enter a valid campus email.";
    const year = Number(values.graduationYear);
    if (!Number.isInteger(year) || year < 2024 || year > 2035) {
      next.graduationYear = "Enter a year between 2024 and 2035.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Verification would normally be triggered by a server route.
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
          placeholder="you@example.edu"
          value={values.email}
          onChange={(event) => update("email")(event.target.value)}
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

      <Button type="submit" size="lg">
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-foreground underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

