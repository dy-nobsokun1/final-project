"use client";

import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "@/lib/api/actions";

/**
 * Settings card for changing the password. It asks for the current password, so someone using a
 * borrowed, signed-in laptop cannot lock the owner out. Every other device is signed out, while this
 * browser stays signed in: changePassword stores the fresh token the API returns.
 */
export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (newPassword.length < 8) {
      setErrors({ newPassword: "Password must be at least 8 characters." });
      return;
    }
    setIsSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsSaving(false);
    // The API's field names (currentPassword, newPassword) match the keys used here.
    setErrors(result.fieldErrors ?? {});
    if (result.error) {
      setStatus(result.error);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setStatus("Password changed. Devices signed in with the old password have been signed out.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Current password" error={errors.currentPassword}>
            <FieldInput
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field label="New password" error={errors.newPassword}>
            <FieldInput
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : "Change password"}
            </Button>
            {status ? (
              <p role="status" className="text-sm text-foreground">
                {status}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
