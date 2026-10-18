"use client";

import { useState } from "react";
import { Field, FieldInput, FieldTextarea } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BakongSettings } from "@/components/profile/BakongSettings";
import { TelegramSettings } from "@/components/profile/TelegramSettings";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/lib/api/actions";

/**
 * Account settings.
 *
 * Name and bio are saved to the API. Email cannot be changed, since it is the campus
 * identity the account was verified with. Notifications: email is always on, and
 * Telegram can be connected (see TelegramSettings). Payments: a Bakong account lets
 * buyers pay you by KHQR (see BakongSettings).
 */
export function SettingsForm() {
  const { user, signOut, setUser } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");

  async function handleSave() {
    setIsSaving(true);
    const result = await updateProfile({ name: name.trim(), bio });
    setIsSaving(false);
    if (result.user) setUser(result.user);
    setStatus(result.error ?? "Profile saved.");
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Sign in to manage your account settings.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Name">
            <FieldInput
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setStatus(null);
              }}
            />
          </Field>
          <Field label="Campus email">
            <FieldInput name="email" type="email" defaultValue={user.email} readOnly />
          </Field>
          <Field label="Bio">
            <FieldTextarea
              name="bio"
              rows={4}
              value={bio}
              onChange={(event) => {
                setBio(event.target.value);
                setStatus(null);
              }}
            />
          </Field>
          {/* Each card saves itself, so it is clear this button does not save the Bakong account below. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
            {status ? (
              <p role="status" className="text-sm text-foreground">
                {status}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <TelegramSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <BakongSettings />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          variant="destructive"
          onClick={() => void signOut()}
          className="border border-brand-danger bg-brand-50 text-brand-ink hover:bg-brand-200"
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, notifications and how buyers pay you.
        </p>
      </header>
      <SettingsForm />
    </div>
  );
}

