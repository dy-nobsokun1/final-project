"use client";

import { useState } from "react";
import { Field, FieldInput, FieldTextarea } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Account settings.
 *
 * Preferences are edited locally and confirmed in the UI only. Persisting them
 * needs a server route, and a real avatar upload needs storage, so neither is
 * faked here. The "Save changes" button is the hook point for that work.
 */
export function SettingsForm() {
  const { user, signOut } = useAuth();
  const [saved, setSaved] = useState(false);
  const [bio, setBio] = useState(user?.bio ?? "");

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
            <FieldInput name="name" defaultValue={user.name} />
          </Field>
          <Field label="Campus email">
            <FieldInput name="email" type="email" defaultValue={user.email} />
          </Field>
          <Field label="Bio">
            <FieldTextarea
              name="bio"
              rows={4}
              value={bio}
              onChange={(event) => {
                setBio(event.target.value);
                setSaved(false);
              }}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email frequency</span>
            <Select name="emailFrequency" defaultValue="daily">
              <SelectTrigger className="w-full" aria-label="Email frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instantly</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="off">No email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="messages" defaultChecked className="size-4" />
            Notify me about new messages
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => setSaved(true)}>Save changes</Button>
        <Button
          variant="destructive"
          onClick={signOut}
          className="border border-brand-danger bg-brand-50 text-brand-ink hover:bg-brand-200"
        >
          Sign out
        </Button>
        {saved ? (
          <p role="status" className="text-sm text-foreground">
            Saved locally. Not yet persisted to a server.
          </p>
        ) : null}
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
          Manage your profile and notification preferences.
        </p>
      </header>
      <SettingsForm />
    </div>
  );
}

