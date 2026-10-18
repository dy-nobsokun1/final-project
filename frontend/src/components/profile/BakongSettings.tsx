"use client";

import { useState } from "react";
import { Field, FieldInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { updateBakongAccount } from "@/lib/api/actions";

/**
 * Where KHQR payments for your items go. With a Bakong account ID saved, buyers see
 * "Pay with KHQR" on your listings and the money goes straight to you. Leave it empty to turn that off.
 */
export function BakongSettings() {
  const { user, setUser } = useAuth();
  const [accountId, setAccountId] = useState(user?.bakongAccountId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    const trimmed = accountId.trim();
    const result = await updateBakongAccount(trimmed || null);
    setIsSaving(false);
    if (result.user) setUser(result.user);
    setMessage(result.error ?? (trimmed
      ? "Saved. Buyers can now pay you by KHQR."
      : "Removed. Buyers can no longer pay you by KHQR."));
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Add your Bakong account ID to let buyers pay you by KHQR. The money goes straight to your
        account: UniSwap never holds it.
      </p>
      <Field label="Bakong account ID">
        <FieldInput
          name="bakongAccountId"
          placeholder="yourname@aclb"
          autoComplete="off"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setMessage(null);
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Find it in your banking app&apos;s KHQR or Bakong profile (it looks like name@bank). Prices are in
        US dollars, so use your dollar account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Bakong account"}
        </Button>
        {message ? <p role="status">{message}</p> : null}
      </div>
    </div>
  );
}
